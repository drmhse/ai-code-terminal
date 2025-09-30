use crate::{MicrosoftGraphClient, MicrosoftAuthError};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{info, warn};
use base64::{Engine as _, engine::general_purpose};

// Microsoft Graph API limitations
const MAX_ATTACHMENT_SIZE: usize = 25 * 1024 * 1024; // 25MB
#[allow(dead_code)]
const MAX_ATTACHMENTS_PER_TASK: usize = 250;
const MAX_LOG_LINES: usize = 100;
#[allow(dead_code)]
const COMPRESSION_QUALITY: u8 = 85; // For image compression

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAttachment {
    pub id: String,
    pub name: String,
    pub content_type: String,
    pub size: usize,
    pub last_modified_date_time: String,
    pub is_inline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentUpload {
    pub name: String,
    pub content: Vec<u8>,
    pub content_type: String,
}

#[derive(Debug, Clone)]
pub enum AttachmentStrategy {
    Upload,           // Direct upload to Microsoft Graph
    Compress,         // Compress before upload (images)
    Truncate,         // Truncate content (logs)
    StoreReference,   // Store in backend, add reference
    Reject,           // Don't attach (source code, large files)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentDecision {
    pub strategy: String, // AttachmentStrategy as string for serialization
    pub reason: String,
    pub size_before: usize,
    pub size_after: Option<usize>,
    pub metadata: Option<serde_json::Value>,
}

pub struct TaskAttachmentService {
    graph_client: MicrosoftGraphClient,
}

impl TaskAttachmentService {
    pub fn new(graph_client: MicrosoftGraphClient) -> Self {
        Self { graph_client }
    }

    /// Analyze file and determine attachment strategy
    pub fn analyze_attachment(&self, file_path: &Path, content: &[u8]) -> AttachmentDecision {
        let size = content.len();
        let extension = file_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        let filename = file_path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown");

        // Strategy decision logic
        let (strategy, reason, size_after) = match self.classify_file(&extension, filename, size) {
            AttachmentStrategy::Upload => {
                if size > MAX_ATTACHMENT_SIZE {
                    (AttachmentStrategy::StoreReference,
                     format!("File too large ({} bytes > {} bytes)", size, MAX_ATTACHMENT_SIZE),
                     None)
                } else {
                    (AttachmentStrategy::Upload, "Direct upload".to_string(), Some(size))
                }
            }
            AttachmentStrategy::Compress => {
                let estimated_compressed = self.estimate_compressed_size(size);
                if estimated_compressed > MAX_ATTACHMENT_SIZE {
                    (AttachmentStrategy::StoreReference,
                     "Even compressed size would be too large".to_string(),
                     Some(estimated_compressed))
                } else {
                    (AttachmentStrategy::Compress,
                     "Image compression to reduce size".to_string(),
                     Some(estimated_compressed))
                }
            }
            AttachmentStrategy::Truncate => {
                let truncated_size = self.estimate_truncated_size(content);
                (AttachmentStrategy::Truncate,
                 format!("Log truncated to last {} lines", MAX_LOG_LINES),
                 Some(truncated_size))
            }
            AttachmentStrategy::StoreReference => {
                (AttachmentStrategy::StoreReference,
                 "Store in backend with reference link".to_string(),
                 None)
            }
            AttachmentStrategy::Reject => {
                (AttachmentStrategy::Reject,
                 "File type not suitable for attachment".to_string(),
                 None)
            }
        };

        AttachmentDecision {
            strategy: format!("{:?}", strategy),
            reason,
            size_before: size,
            size_after,
            metadata: Some(serde_json::json!({
                "extension": extension,
                "filename": filename,
                "is_text": self.is_text_file(&extension),
                "is_image": self.is_image_file(&extension),
                "is_log": self.is_log_file(&extension, filename),
            })),
        }
    }

    /// Classify file type and determine initial strategy
    fn classify_file(&self, extension: &str, filename: &str, size: usize) -> AttachmentStrategy {
        // Reject source code files - use git references instead
        if self.is_source_code(extension) {
            return AttachmentStrategy::Reject;
        }

        // Reject build artifacts and large binaries
        if self.is_build_artifact(extension, filename) {
            return AttachmentStrategy::Reject;
        }

        // Reject videos - too large
        if self.is_video_file(extension) {
            return AttachmentStrategy::Reject;
        }

        // Compress images/screenshots
        if self.is_image_file(extension) {
            return AttachmentStrategy::Compress;
        }

        // Truncate log files
        if self.is_log_file(extension, filename) {
            return AttachmentStrategy::Truncate;
        }

        // Small text files can be uploaded directly
        if self.is_text_file(extension) && size < MAX_ATTACHMENT_SIZE / 4 {
            return AttachmentStrategy::Upload;
        }

        // Large files get stored as references
        if size > MAX_ATTACHMENT_SIZE {
            return AttachmentStrategy::StoreReference;
        }

        // Default to upload for other file types
        AttachmentStrategy::Upload
    }

    /// Process attachment according to strategy
    pub async fn process_attachment(
        &self,
        access_token: &str,
        task_id: &str,
        file_path: &Path,
        content: Vec<u8>,
        strategy: AttachmentStrategy
    ) -> Result<Option<TaskAttachment>, MicrosoftAuthError> {
        match strategy {
            AttachmentStrategy::Upload => {
                self.upload_attachment(access_token, task_id, file_path, content).await
            }
            AttachmentStrategy::Compress => {
                let compressed = self.compress_image(content)?;
                self.upload_attachment(access_token, task_id, file_path, compressed).await
            }
            AttachmentStrategy::Truncate => {
                let truncated = self.truncate_log_content(content);
                self.upload_attachment(access_token, task_id, file_path, truncated).await
            }
            AttachmentStrategy::StoreReference => {
                self.store_file_reference(task_id, file_path, content).await
            }
            AttachmentStrategy::Reject => {
                info!("Rejecting attachment: {:?}", file_path);
                Ok(None)
            }
        }
    }

    /// Upload attachment directly to Microsoft Graph
    async fn upload_attachment(
        &self,
        access_token: &str,
        task_id: &str,
        file_path: &Path,
        content: Vec<u8>
    ) -> Result<Option<TaskAttachment>, MicrosoftAuthError> {
        let filename = file_path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("attachment");

        let content_type = self.get_content_type(file_path);

        info!("Uploading attachment {} ({} bytes) to task {}", filename, content.len(), task_id);

        // Use Microsoft Graph API to upload attachment
        let attachment_data = serde_json::json!({
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": filename,
            "contentBytes": general_purpose::STANDARD.encode(&content),
            "contentType": content_type,
        });

        let url = format!("me/todo/lists/*/tasks/{}/attachments", task_id);
        let response = self.graph_client.post(access_token, &url, attachment_data).await?;
        let json_response: serde_json::Value = response.json().await
            .map_err(|e| MicrosoftAuthError::GraphApi(crate::GraphApiError::NetworkError(e)))?;

        let attachment = TaskAttachment {
            id: json_response["id"].as_str().unwrap_or("").to_string(),
            name: filename.to_string(),
            content_type,
            size: content.len(),
            last_modified_date_time: json_response["lastModifiedDateTime"]
                .as_str().unwrap_or("").to_string(),
            is_inline: false,
        };

        Ok(Some(attachment))
    }

    /// Compress image before upload
    fn compress_image(&self, content: Vec<u8>) -> Result<Vec<u8>, MicrosoftAuthError> {
        // TODO: Implement actual image compression
        // For now, return original content
        // In a real implementation, you'd use image processing libraries like `image` crate
        warn!("Image compression not yet implemented - returning original");
        Ok(content)
    }

    /// Truncate log content to last N lines
    fn truncate_log_content(&self, content: Vec<u8>) -> Vec<u8> {
        let content_str = String::from_utf8_lossy(&content);
        let lines: Vec<&str> = content_str.lines().collect();

        if lines.len() <= MAX_LOG_LINES {
            return content;
        }

        let truncated_lines = &lines[lines.len() - MAX_LOG_LINES..];
        let header = format!("... (truncated to last {} lines of {} total lines) ...\n\n",
                           MAX_LOG_LINES, lines.len());

        let mut truncated = header.into_bytes();
        truncated.extend(truncated_lines.join("\n").into_bytes());
        truncated
    }

    /// Store file in backend and return reference
    async fn store_file_reference(
        &self,
        _task_id: &str,
        file_path: &Path,
        content: Vec<u8>
    ) -> Result<Option<TaskAttachment>, MicrosoftAuthError> {
        // TODO: Implement backend file storage
        // This would involve:
        // 1. Store file in backend storage (filesystem, S3, etc.)
        // 2. Generate download URL
        // 3. Add reference note to task body

        let filename = file_path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("attachment");

        info!("Storing file reference for {} ({} bytes)", filename, content.len());

        // For now, just create a reference note
        let _reference_note = format!(
            "\n\n📎 **File Reference**: {} ({} bytes)\n*File stored in backend - contact admin for access*\n",
            filename,
            content.len()
        );

        // Add to task notes instead of as attachment
        // This would typically update the task body with the reference
        warn!("Backend file storage not yet implemented - would add reference to task notes");

        Ok(None)
    }

    /// Get existing attachments for a task
    pub async fn get_task_attachments(&self, access_token: &str, task_id: &str) -> Result<Vec<TaskAttachment>, MicrosoftAuthError> {
        let url = format!("me/todo/lists/*/tasks/{}/attachments", task_id);
        let response = self.graph_client.get(access_token, &url).await?;
        let json_response: serde_json::Value = response.json().await
            .map_err(|e| MicrosoftAuthError::GraphApi(crate::GraphApiError::NetworkError(e)))?;

        let attachments = json_response["value"].as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| {
                Some(TaskAttachment {
                    id: item["id"].as_str()?.to_string(),
                    name: item["name"].as_str()?.to_string(),
                    content_type: item["contentType"].as_str()?.to_string(),
                    size: item["size"].as_u64().unwrap_or(0) as usize,
                    last_modified_date_time: item["lastModifiedDateTime"]
                        .as_str()?.to_string(),
                    is_inline: item["isInline"].as_bool().unwrap_or(false),
                })
            })
            .collect();

        Ok(attachments)
    }

    // Helper methods for file classification
    fn is_source_code(&self, extension: &str) -> bool {
        matches!(extension,
            "rs" | "js" | "ts" | "tsx" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "hpp" |
            "cs" | "go" | "php" | "rb" | "swift" | "kt" | "dart" | "scala" | "clj" | "hs"
        )
    }

    fn is_build_artifact(&self, extension: &str, filename: &str) -> bool {
        matches!(extension, "exe" | "dll" | "so" | "dylib" | "a" | "lib") ||
        filename.contains("target/") ||
        filename.contains("node_modules/") ||
        filename.contains("build/") ||
        filename.contains("dist/")
    }

    fn is_video_file(&self, extension: &str) -> bool {
        matches!(extension, "mp4" | "avi" | "mov" | "wmv" | "flv" | "webm")
    }

    fn is_image_file(&self, extension: &str) -> bool {
        matches!(extension, "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg")
    }

    fn is_text_file(&self, extension: &str) -> bool {
        matches!(extension,
            "txt" | "md" | "yaml" | "yml" | "json" | "xml" | "html" | "css" |
            "sql" | "sh" | "bat" | "ps1" | "toml" | "ini" | "conf"
        )
    }

    fn is_log_file(&self, extension: &str, filename: &str) -> bool {
        extension == "log" ||
        filename.contains(".log") ||
        filename.ends_with(".out") ||
        filename.ends_with(".err")
    }

    fn estimate_compressed_size(&self, original_size: usize) -> usize {
        // Rough estimation - JPEG typically compresses to 10-50% of original
        (original_size as f64 * 0.3) as usize
    }

    fn estimate_truncated_size(&self, content: &[u8]) -> usize {
        let content_str = String::from_utf8_lossy(content);
        let lines: Vec<&str> = content_str.lines().collect();

        if lines.len() <= MAX_LOG_LINES {
            return content.len();
        }

        // Estimate based on average line length
        let avg_line_length = content.len() / lines.len();
        avg_line_length * MAX_LOG_LINES + 100 // +100 for header
    }

    fn get_content_type(&self, file_path: &Path) -> String {
        let extension = file_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "jpg" | "jpeg" => "image/jpeg".to_string(),
            "png" => "image/png".to_string(),
            "gif" => "image/gif".to_string(),
            "pdf" => "application/pdf".to_string(),
            "txt" => "text/plain".to_string(),
            "json" => "application/json".to_string(),
            "xml" => "application/xml".to_string(),
            "log" => "text/plain".to_string(),
            _ => "application/octet-stream".to_string(),
        }
    }
}