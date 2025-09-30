use serde::{Deserialize, Serialize};
use thiserror::Error;
use regex::Regex;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Error)]
pub enum TaskContextError {
    #[error("Invalid JSON in context: {0}")]
    InvalidJson(#[from] serde_json::Error),

    #[error("Context parsing failed: {0}")]
    ParsingFailed(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Base64 decoding failed: {0}")]
    Base64DecodingFailed(#[from] base64::DecodeError),
}

/// Developer context metadata embedded in task notes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskContext {
    /// File path relative to workspace root
    pub file: String,

    /// Line range [start, end] (both inclusive)
    pub lines: Option<[u32; 2]>,

    /// Git branch name
    pub branch: Option<String>,

    /// Git commit hash
    pub commit: Option<String>,

    /// Programming language
    pub language: Option<String>,

    /// Code snippet or function name
    pub context_snippet: Option<String>,

    /// Base64 encoded error log (if applicable)
    pub error_log: Option<String>,
}

/// Parsed task note with separate human-readable content and metadata
#[derive(Debug, Clone)]
pub struct ParsedTaskNote {
    /// Human-readable description
    pub description: String,

    /// Developer context metadata (if present)
    pub context: Option<TaskContext>,
}

/// Service for parsing and injecting developer context into Microsoft To Do task notes
///
/// This service handles the structured format specified in Phase 2:
/// ```markdown
/// [Human readable description]
///
/// ---
/// <!-- DEV-CONTEXT
/// {
///   "file": "src/auth/oauth.rs",
///   "lines": [45, 67],
///   "branch": "fix-oauth-refresh",
///   "commit": "abc123",
///   "language": "rust",
///   "context_snippet": "fn refresh_token(...",
///   "error_log": "base64_encoded_if_exists"
/// }
/// -->
/// ```
pub struct TaskContextParser {
    context_regex: Regex,
}

impl TaskContextParser {
    const CONTEXT_START_MARKER: &'static str = "<!-- DEV-CONTEXT";
    const CONTEXT_END_MARKER: &'static str = "-->";
    const SECTION_SEPARATOR: &'static str = "---";

    pub fn new() -> Result<Self, TaskContextError> {
        // Regex to extract context JSON from HTML comments
        let context_regex = Regex::new(r"<!--\s*DEV-CONTEXT\s*\n([\s\S]*?)\n\s*-->")
            .map_err(|e| TaskContextError::ParsingFailed(format!("Failed to compile regex: {}", e)))?;

        Ok(Self { context_regex })
    }

    /// Parse a task note into description and context metadata
    pub fn parse_note(&self, note_content: &str) -> Result<ParsedTaskNote, TaskContextError> {
        // Try to extract context first
        let context = self.extract_context(note_content)?;

        // Extract description by removing context section
        let description = if context.is_some() {
            self.extract_description(note_content)
        } else {
            note_content.to_string()
        };

        Ok(ParsedTaskNote {
            description: description.trim().to_string(),
            context,
        })
    }

    /// Inject context metadata into a human-readable description
    pub fn inject_context(&self, description: &str, context: &TaskContext) -> Result<String, TaskContextError> {
        let context_json = serde_json::to_string_pretty(context)?;

        let formatted_note = format!(
            "{}\n\n{}\n{}\n{}\n{}",
            description.trim(),
            Self::SECTION_SEPARATOR,
            Self::CONTEXT_START_MARKER,
            context_json,
            Self::CONTEXT_END_MARKER
        );

        Ok(formatted_note)
    }

    /// Extract context metadata from note content
    fn extract_context(&self, note_content: &str) -> Result<Option<TaskContext>, TaskContextError> {
        if let Some(captures) = self.context_regex.captures(note_content) {
            if let Some(json_match) = captures.get(1) {
                let json_str = json_match.as_str().trim();

                // Parse and validate the JSON
                let context: TaskContext = serde_json::from_str(json_str)?;

                // Validate required fields
                if context.file.is_empty() {
                    return Err(TaskContextError::MissingField("file".to_string()));
                }

                return Ok(Some(context));
            }
        }

        Ok(None)
    }

    /// Extract human-readable description by removing context section
    fn extract_description(&self, note_content: &str) -> String {
        // Find the separator line that precedes the context
        if let Some(separator_pos) = note_content.rfind(&format!("\n{}\n", Self::SECTION_SEPARATOR)) {
            note_content[..separator_pos].to_string()
        } else if let Some(context_start) = note_content.find(Self::CONTEXT_START_MARKER) {
            // Fallback: look for context start marker
            note_content[..context_start].trim_end().to_string()
        } else {
            note_content.to_string()
        }
    }

    /// Validate that a task context has all required fields and sensible values
    pub fn validate_context(&self, context: &TaskContext) -> Result<(), TaskContextError> {
        // File path is required
        if context.file.is_empty() {
            return Err(TaskContextError::MissingField("file".to_string()));
        }

        // Validate line numbers if present
        if let Some([start, end]) = context.lines {
            if start == 0 {
                return Err(TaskContextError::ParsingFailed("Line numbers must be >= 1".to_string()));
            }
            if start > end {
                return Err(TaskContextError::ParsingFailed("Start line must be <= end line".to_string()));
            }
        }

        // Validate base64 error log if present
        if let Some(ref error_log) = context.error_log {
            general_purpose::STANDARD.decode(error_log)?;
        }

        Ok(())
    }

    /// Check if a note contains developer context metadata
    pub fn has_context(&self, note_content: &str) -> bool {
        note_content.contains(Self::CONTEXT_START_MARKER)
    }

    /// Remove context metadata from a note, leaving only the description
    pub fn strip_context(&self, note_content: &str) -> String {
        self.extract_description(note_content)
    }

    /// Decode error log from base64 if present
    pub fn decode_error_log(&self, context: &TaskContext) -> Result<Option<String>, TaskContextError> {
        if let Some(ref encoded_log) = context.error_log {
            let decoded_bytes = general_purpose::STANDARD.decode(encoded_log)?;
            let decoded_string = String::from_utf8_lossy(&decoded_bytes).to_string();
            Ok(Some(decoded_string))
        } else {
            Ok(None)
        }
    }

    /// Encode error log to base64 for storage
    pub fn encode_error_log(&self, error_log: &str) -> String {
        general_purpose::STANDARD.encode(error_log.as_bytes())
    }

    /// Create context with error log
    #[allow(clippy::too_many_arguments)]
    pub fn create_context_with_error(
        &self,
        file: String,
        lines: Option<[u32; 2]>,
        branch: Option<String>,
        commit: Option<String>,
        language: Option<String>,
        context_snippet: Option<String>,
        error_log: Option<&str>,
    ) -> TaskContext {
        TaskContext {
            file,
            lines,
            branch,
            commit,
            language,
            context_snippet,
            error_log: error_log.map(|log| self.encode_error_log(log)),
        }
    }
}

impl Default for TaskContextParser {
    fn default() -> Self {
        Self::new().expect("Failed to create TaskContextParser")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_note_with_context() {
        let parser = TaskContextParser::new().unwrap();

        let note = r#"Fix authentication timeout issue

The OAuth refresh token is not being renewed properly.

---
<!-- DEV-CONTEXT
{
  "file": "src/auth/oauth.rs",
  "lines": [45, 67],
  "branch": "fix-oauth-refresh",
  "commit": "abc123",
  "language": "rust",
  "context_snippet": "fn refresh_token(...",
  "error_log": null
}
-->"#;

        let parsed = parser.parse_note(note).unwrap();

        assert_eq!(parsed.description, "Fix authentication timeout issue\n\nThe OAuth refresh token is not being renewed properly.");
        assert!(parsed.context.is_some());

        let context = parsed.context.unwrap();
        assert_eq!(context.file, "src/auth/oauth.rs");
        assert_eq!(context.lines, Some([45, 67]));
        assert_eq!(context.branch, Some("fix-oauth-refresh".to_string()));
    }

    #[test]
    fn test_parse_note_without_context() {
        let parser = TaskContextParser::new().unwrap();

        let note = "Simple task without any code context";
        let parsed = parser.parse_note(note).unwrap();

        assert_eq!(parsed.description, "Simple task without any code context");
        assert!(parsed.context.is_none());
    }

    #[test]
    fn test_inject_context() {
        let parser = TaskContextParser::new().unwrap();

        let description = "Fix the bug in user authentication";
        let context = TaskContext {
            file: "src/auth.rs".to_string(),
            lines: Some([100, 120]),
            branch: Some("main".to_string()),
            commit: Some("def456".to_string()),
            language: Some("rust".to_string()),
            context_snippet: Some("fn authenticate_user".to_string()),
            error_log: None,
        };

        let note = parser.inject_context(description, &context).unwrap();

        assert!(note.contains(description));
        assert!(note.contains("src/auth.rs"));
        assert!(note.contains("<!-- DEV-CONTEXT"));
        assert!(note.contains("-->"));
    }

    #[test]
    fn test_validate_context() {
        let parser = TaskContextParser::new().unwrap();

        let valid_context = TaskContext {
            file: "src/main.rs".to_string(),
            lines: Some([1, 10]),
            branch: None,
            commit: None,
            language: None,
            context_snippet: None,
            error_log: None,
        };

        assert!(parser.validate_context(&valid_context).is_ok());

        let invalid_context = TaskContext {
            file: "".to_string(), // Empty file path
            lines: None,
            branch: None,
            commit: None,
            language: None,
            context_snippet: None,
            error_log: None,
        };

        assert!(parser.validate_context(&invalid_context).is_err());
    }

    #[test]
    fn test_error_log_encoding() {
        let parser = TaskContextParser::new().unwrap();

        let error_message = "panic at 'index out of bounds'";
        let encoded = parser.encode_error_log(error_message);

        let context = TaskContext {
            file: "src/main.rs".to_string(),
            lines: None,
            branch: None,
            commit: None,
            language: None,
            context_snippet: None,
            error_log: Some(encoded),
        };

        let decoded = parser.decode_error_log(&context).unwrap();
        assert_eq!(decoded, Some(error_message.to_string()));
    }
}