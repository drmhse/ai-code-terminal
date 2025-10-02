use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use thiserror::Error;
use tracing::{debug, error, info, warn};
use url::Url;

#[derive(Debug, Error)]
pub enum GraphApiError {
    #[error("Authentication required: {0}")]
    AuthenticationRequired(String),

    #[error("Rate limited: retry after {retry_after_seconds} seconds")]
    RateLimited { retry_after_seconds: u64 },

    #[error("API request failed: {status} - {message}")]
    RequestFailed { status: u16, message: String },

    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),

    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Invalid URL: {0}")]
    InvalidUrl(#[from] url::ParseError),

    #[error("Resource not found: {resource}")]
    NotFound { resource: String },

    #[error("Permission denied: {operation}")]
    PermissionDenied { operation: String },
}

// Microsoft Graph API Data Models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskList {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "isOwner")]
    pub is_owner: bool,
    #[serde(rename = "isShared")]
    pub is_shared: bool,
    #[serde(rename = "wellknownListName")]
    pub wellknown_list_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub body: Option<TaskBody>,
    pub status: TaskStatus,
    pub importance: TaskImportance,
    #[serde(rename = "dueDateTime")]
    pub due_date_time: Option<TaskDateTime>,
    #[serde(rename = "createdDateTime")]
    pub created_date_time: String,
    #[serde(rename = "lastModifiedDateTime")]
    pub last_modified_date_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskBody {
    pub content: String,
    #[serde(rename = "contentType")]
    pub content_type: String, // "text" or "html"
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    NotStarted,
    InProgress,
    Completed,
    WaitingOnOthers,
    Deferred,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskImportance {
    Low,
    Normal,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDateTime {
    #[serde(rename = "dateTime")]
    pub date_time: String,
    #[serde(rename = "timeZone")]
    pub time_zone: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChecklistItem {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "isChecked")]
    pub is_checked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub body: Option<TaskBody>,
    pub importance: Option<TaskImportance>,
    #[serde(rename = "dueDateTime")]
    pub due_date_time: Option<TaskDateTime>,
    pub status: Option<TaskStatus>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateListRequest {
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateChecklistItemRequest {
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphApiResponse<T> {
    pub value: Vec<T>,
    #[serde(rename = "@odata.nextLink")]
    pub next_link: Option<String>,
}

/// Microsoft Graph API client for To Do operations
///
/// Handles authentication, rate limiting, and retry logic for all
/// Microsoft To Do API interactions.
pub struct MicrosoftGraphClient {
    client: Client,
    base_url: Url,
}

impl MicrosoftGraphClient {
    const GRAPH_API_BASE: &'static str = "https://graph.microsoft.com/v1.0/";
    const MAX_RETRIES: u32 = 3;
    const INITIAL_RETRY_DELAY: Duration = Duration::from_millis(1000);

    pub fn new() -> Result<Self, GraphApiError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("ACT-Terminal/1.0")
            .build()?;

        let base_url = Url::parse(Self::GRAPH_API_BASE)?;

        info!("Microsoft Graph client initialized");
        Ok(Self { client, base_url })
    }

    /// Get all task lists for the authenticated user
    pub async fn get_task_lists(
        &self,
        access_token: &str,
        pagination: Option<&act_core::PaginationParams>,
    ) -> Result<(Vec<TaskList>, Option<String>), GraphApiError> {
        debug!("Fetching task lists");

        let mut url = self.base_url.join("me/todo/lists")?;

        // Add pagination parameters if provided
        if let Some(pagination) = pagination {
            let mut query_pairs = url.query_pairs_mut();

            if let Some(limit) = pagination.limit {
                query_pairs.append_pair("$top", &limit.to_string());
            }

            // If offset is provided, use $skip
            if let Some(offset) = pagination.offset {
                query_pairs.append_pair("$skip", &offset.to_string());
            }

            // If page is provided, calculate offset from page_size
            if let Some(page) = pagination.page {
                if let Some(page_size) = pagination.page_size {
                    let offset = (page - 1) * page_size;
                    query_pairs.append_pair("$skip", &offset.to_string());
                    query_pairs.append_pair("$top", &page_size.to_string());
                }
            }

            // Add ordering for consistent pagination
            query_pairs.append_pair("$orderby", "displayName");
        }

        debug!("Request URL: {}", url);
        debug!(
            "Access token (first 20 chars): {}",
            &access_token[..access_token.len().min(20)]
        );

        match self.make_authenticated_request(access_token, &url).await {
            Ok(response) => {
                let status = response.status();
                let response_text = response.text().await?;
                debug!(
                    "Graph API response status: {}, body length: {}, body: {}",
                    status,
                    response_text.len(),
                    response_text
                );

                // Check if the response is successful but empty
                if response_text.is_empty() {
                    debug!("Empty response body received");
                    return Ok((vec![], None));
                }

                let api_response: GraphApiResponse<TaskList> = serde_json::from_str(&response_text)
                    .map_err(|e| {
                        error!(
                            "Failed to parse task lists response: {}. Response body: {}",
                            e, response_text
                        );
                        GraphApiError::JsonError(e)
                    })?;

                debug!("Retrieved {} task lists", api_response.value.len());

                // Log each task list for debugging
                for (i, list) in api_response.value.iter().enumerate() {
                    debug!(
                        "Task list {}: id='{}', name='{}', is_owner={}, wellknown='{:?}'",
                        i, list.id, list.display_name, list.is_owner, list.wellknown_list_name
                    );
                }

                let next_link = api_response.next_link.clone();
                Ok((api_response.value, next_link))
            }
            Err(GraphApiError::NotFound { resource }) => {
                // This should NOT happen if user has valid authentication and lists exist
                warn!("Received 404 Not Found for task lists request. This may indicate an authentication or API issue. Resource: {}", resource);

                // Instead of returning empty array, let's return the error so we can debug it
                Err(GraphApiError::NotFound { resource })
            }
            Err(e) => {
                error!("Error fetching task lists: {}", e);
                Err(e)
            }
        }
    }

    /// Create a new task list
    pub async fn create_task_list(
        &self,
        access_token: &str,
        request: CreateListRequest,
    ) -> Result<TaskList, GraphApiError> {
        debug!("Creating task list: {}", request.display_name);

        let url = self.base_url.join("me/todo/lists")?;
        debug!("POST URL: {}", url);
        debug!("Request payload: {:?}", request);

        match self
            .make_authenticated_post(access_token, &url, &request)
            .await
        {
            Ok(response) => {
                let status = response.status();
                let response_text = response.text().await?;
                debug!(
                    "Create list response status: {}, body: {}",
                    status, response_text
                );

                let task_list: TaskList = serde_json::from_str(&response_text)?;
                info!(
                    "Created task list: {} ({})",
                    task_list.display_name, task_list.id
                );
                Ok(task_list)
            }
            Err(e) => {
                error!(
                    "Failed to create task list '{}': {}",
                    request.display_name, e
                );
                Err(e)
            }
        }
    }

    /// Get tasks from a specific list
    pub async fn get_tasks(
        &self,
        access_token: &str,
        list_id: &str,
        pagination: Option<&act_core::PaginationParams>,
    ) -> Result<(Vec<Task>, Option<String>), GraphApiError> {
        debug!("Fetching tasks for list: {}", list_id);

        let mut url = self
            .base_url
            .join(&format!("me/todo/lists/{}/tasks", list_id))?;

        // Add pagination parameters if provided
        if let Some(pagination) = pagination {
            let mut query_pairs = url.query_pairs_mut();

            if let Some(limit) = pagination.limit {
                query_pairs.append_pair("$top", &limit.to_string());
            }

            // If offset is provided, use $skip
            if let Some(offset) = pagination.offset {
                query_pairs.append_pair("$skip", &offset.to_string());
            }

            // If page is provided, calculate offset from page_size
            if let Some(page) = pagination.page {
                if let Some(page_size) = pagination.page_size {
                    let offset = (page - 1) * page_size;
                    query_pairs.append_pair("$skip", &offset.to_string());
                    query_pairs.append_pair("$top", &page_size.to_string());
                }
            }

            // Add ordering for consistent pagination
            query_pairs.append_pair("$orderby", "createdDateTime");
        }

        let response = self.make_authenticated_request(access_token, &url).await?;

        let api_response: GraphApiResponse<Task> = response.json().await?;

        debug!(
            "Retrieved {} tasks from list {}",
            api_response.value.len(),
            list_id
        );

        let next_link = api_response.next_link.clone();
        Ok((api_response.value, next_link))
    }

    /// Get a single task by ID from a specific list
    pub async fn get_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<Task, GraphApiError> {
        debug!("Fetching task {} from list {}", task_id, list_id);

        let url = self
            .base_url
            .join(&format!("me/todo/lists/{}/tasks/{}", list_id, task_id))?;
        let response = self.make_authenticated_request(access_token, &url).await?;

        let task: Task = response.json().await?;

        debug!("Retrieved task: {} ({})", task.title, task.id);
        Ok(task)
    }

    /// Create a new task in a specific list
    pub async fn create_task(
        &self,
        access_token: &str,
        list_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, GraphApiError> {
        debug!("Creating task '{}' in list {}", request.title, list_id);

        let url = self
            .base_url
            .join(&format!("me/todo/lists/{}/tasks", list_id))?;
        let response = self
            .make_authenticated_post(access_token, &url, &request)
            .await?;

        let task: Task = response.json().await?;

        info!("Created task: {} ({})", task.title, task.id);
        Ok(task)
    }

    /// Patch a task with arbitrary JSON data
    pub async fn patch_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        patch_data: serde_json::Value,
    ) -> Result<Task, GraphApiError> {
        debug!("Patching task {} in list {}", task_id, list_id);

        let url = self
            .base_url
            .join(&format!("me/todo/lists/{}/tasks/{}", list_id, task_id))?;
        let response = self
            .make_authenticated_patch(access_token, &url, &patch_data)
            .await?;

        let task: Task = response.json().await?;

        debug!("Patched task: {} ({})", task.title, task.id);
        Ok(task)
    }

    /// Update an existing task
    pub async fn update_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, GraphApiError> {
        debug!("Updating task {} in list {}", task_id, list_id);

        let url = self
            .base_url
            .join(&format!("me/todo/lists/{}/tasks/{}", list_id, task_id))?;
        let response = self
            .make_authenticated_patch(access_token, &url, &request)
            .await?;

        let task: Task = response.json().await?;

        debug!("Updated task: {} ({})", task.title, task.id);
        Ok(task)
    }

    /// Delete a task
    pub async fn delete_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<(), GraphApiError> {
        debug!("Deleting task {} from list {}", task_id, list_id);

        let url = self
            .base_url
            .join(&format!("me/todo/lists/{}/tasks/{}", list_id, task_id))?;
        self.make_authenticated_delete(access_token, &url).await?;

        info!("Deleted task {} from list {}", task_id, list_id);
        Ok(())
    }

    /// Get checklist items for a task
    pub async fn get_checklist_items(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<Vec<ChecklistItem>, GraphApiError> {
        debug!(
            "Fetching checklist items for task {} in list {}",
            task_id, list_id
        );

        let url = self.base_url.join(&format!(
            "me/todo/lists/{}/tasks/{}/checklistItems",
            list_id, task_id
        ))?;
        let response = self.make_authenticated_request(access_token, &url).await?;

        let api_response: GraphApiResponse<ChecklistItem> = response.json().await?;

        debug!("Retrieved {} checklist items", api_response.value.len());
        Ok(api_response.value)
    }

    /// Create a checklist item for a task
    pub async fn create_checklist_item(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        request: CreateChecklistItemRequest,
    ) -> Result<ChecklistItem, GraphApiError> {
        debug!(
            "Creating checklist item '{}' for task {}",
            request.display_name, task_id
        );

        let url = self.base_url.join(&format!(
            "me/todo/lists/{}/tasks/{}/checklistItems",
            list_id, task_id
        ))?;
        let response = self
            .make_authenticated_post(access_token, &url, &request)
            .await?;

        let item: ChecklistItem = response.json().await?;

        debug!(
            "Created checklist item: {} ({})",
            item.display_name, item.id
        );
        Ok(item)
    }

    /// Generic GET request
    pub async fn get(
        &self,
        access_token: &str,
        url: &str,
    ) -> Result<reqwest::Response, GraphApiError> {
        let full_url = if url.starts_with("https://") {
            url.parse()?
        } else {
            self.base_url.join(url)?
        };
        self.make_authenticated_request(access_token, &full_url)
            .await
    }

    /// Generic POST request
    pub async fn post<T: Serialize>(
        &self,
        access_token: &str,
        url: &str,
        body: T,
    ) -> Result<reqwest::Response, GraphApiError> {
        let full_url = self.base_url.join(url)?;
        self.make_authenticated_post(access_token, &full_url, &body)
            .await
    }

    // Private helper methods

    async fn make_authenticated_request(
        &self,
        access_token: &str,
        url: &Url,
    ) -> Result<reqwest::Response, GraphApiError> {
        debug!("Making authenticated request to URL: {}", url);
        debug!(
            "Using access token (first 50 chars): {}...",
            &access_token[..access_token.len().min(50)]
        );

        self.execute_with_retry(|| async {
            let request = self
                .client
                .get(url.clone())
                .bearer_auth(access_token)
                .header("User-Agent", "ACT-Terminal/1.0")
                .header("Accept", "application/json")
                .header("Content-Type", "application/json");

            debug!(
                "Request headers: Authorization=Bearer {}..., User-Agent=ACT-Terminal/1.0",
                &access_token[..access_token.len().min(20)]
            );

            request.send().await
        })
        .await
    }

    async fn make_authenticated_post<T: Serialize>(
        &self,
        access_token: &str,
        url: &Url,
        body: &T,
    ) -> Result<reqwest::Response, GraphApiError> {
        self.execute_with_retry(|| async {
            self.client
                .post(url.clone())
                .bearer_auth(access_token)
                .json(body)
                .send()
                .await
        })
        .await
    }

    async fn make_authenticated_patch<T: Serialize>(
        &self,
        access_token: &str,
        url: &Url,
        body: &T,
    ) -> Result<reqwest::Response, GraphApiError> {
        self.execute_with_retry(|| async {
            self.client
                .patch(url.clone())
                .bearer_auth(access_token)
                .json(body)
                .send()
                .await
        })
        .await
    }

    async fn make_authenticated_delete(
        &self,
        access_token: &str,
        url: &Url,
    ) -> Result<reqwest::Response, GraphApiError> {
        self.execute_with_retry(|| async {
            self.client
                .delete(url.clone())
                .bearer_auth(access_token)
                .send()
                .await
        })
        .await
    }

    async fn execute_with_retry<F, Fut>(
        &self,
        request_fn: F,
    ) -> Result<reqwest::Response, GraphApiError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<reqwest::Response, reqwest::Error>>,
    {
        let mut delay = Self::INITIAL_RETRY_DELAY;

        for attempt in 0..=Self::MAX_RETRIES {
            let start_time = Instant::now();

            match request_fn().await {
                Ok(response) => {
                    let status = response.status();
                    let duration = start_time.elapsed();

                    // Log performance metrics
                    debug!(
                        "Graph API request completed in {:?} with status {}",
                        duration, status
                    );

                    match status {
                        StatusCode::OK | StatusCode::CREATED | StatusCode::NO_CONTENT => {
                            return Ok(response);
                        }
                        StatusCode::UNAUTHORIZED => {
                            let error_text = response.text().await.unwrap_or_default();
                            error!("Authentication failed: {}", error_text);
                            return Err(GraphApiError::AuthenticationRequired(error_text));
                        }
                        StatusCode::FORBIDDEN => {
                            let error_text = response.text().await.unwrap_or_default();
                            return Err(GraphApiError::PermissionDenied {
                                operation: error_text,
                            });
                        }
                        StatusCode::NOT_FOUND => {
                            let error_text = response.text().await.unwrap_or_default();
                            error!("Graph API 404 error: {}", error_text);
                            return Err(GraphApiError::NotFound {
                                resource: format!("Requested resource not found: {}", error_text),
                            });
                        }
                        StatusCode::TOO_MANY_REQUESTS => {
                            let retry_after = response
                                .headers()
                                .get("Retry-After")
                                .and_then(|h| h.to_str().ok())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(60);

                            warn!("Rate limited by Microsoft Graph API, retry after {} seconds (attempt {}/{})",
                                  retry_after, attempt + 1, Self::MAX_RETRIES + 1);

                            if attempt < Self::MAX_RETRIES {
                                tokio::time::sleep(Duration::from_secs(retry_after)).await;
                                continue;
                            } else {
                                error!("Max retries exceeded for rate limited request");
                                return Err(GraphApiError::RateLimited {
                                    retry_after_seconds: retry_after,
                                });
                            }
                        }
                        _ => {
                            let error_text = response.text().await.unwrap_or_default();
                            if attempt < Self::MAX_RETRIES {
                                warn!(
                                    "Request failed with status {}, retrying (attempt {}/{})",
                                    status,
                                    attempt + 1,
                                    Self::MAX_RETRIES + 1
                                );
                                tokio::time::sleep(delay).await;
                                delay = delay.saturating_mul(2); // Exponential backoff
                                continue;
                            } else {
                                return Err(GraphApiError::RequestFailed {
                                    status: status.as_u16(),
                                    message: error_text,
                                });
                            }
                        }
                    }
                }
                Err(e) => {
                    if attempt < Self::MAX_RETRIES {
                        warn!(
                            "Network error, retrying (attempt {}/{}): {}",
                            attempt + 1,
                            Self::MAX_RETRIES + 1,
                            e
                        );
                        tokio::time::sleep(delay).await;
                        delay = delay.saturating_mul(2);
                        continue;
                    } else {
                        return Err(GraphApiError::NetworkError(e));
                    }
                }
            }
        }

        unreachable!("Retry loop should have returned or errored")
    }
}

/// Trait for dependency injection and testing
#[async_trait::async_trait]
pub trait GraphClient: Send + Sync {
    async fn get_task_lists(
        &self,
        access_token: &str,
        pagination: Option<&act_core::PaginationParams>,
    ) -> Result<(Vec<TaskList>, Option<String>), GraphApiError>;
    async fn create_task_list(
        &self,
        access_token: &str,
        request: CreateListRequest,
    ) -> Result<TaskList, GraphApiError>;
    async fn get_tasks(
        &self,
        access_token: &str,
        list_id: &str,
        pagination: Option<&act_core::PaginationParams>,
    ) -> Result<(Vec<Task>, Option<String>), GraphApiError>;
    async fn get_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<Task, GraphApiError>;
    async fn create_task(
        &self,
        access_token: &str,
        list_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, GraphApiError>;
    async fn patch_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        patch_data: serde_json::Value,
    ) -> Result<Task, GraphApiError>;
    async fn update_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, GraphApiError>;
    async fn delete_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<(), GraphApiError>;
    async fn get_checklist_items(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<Vec<ChecklistItem>, GraphApiError>;
    async fn create_checklist_item(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        request: CreateChecklistItemRequest,
    ) -> Result<ChecklistItem, GraphApiError>;
}

#[async_trait::async_trait]
impl GraphClient for MicrosoftGraphClient {
    async fn get_task_lists(
        &self,
        access_token: &str,
        pagination: Option<&act_core::PaginationParams>,
    ) -> Result<(Vec<TaskList>, Option<String>), GraphApiError> {
        self.get_task_lists(access_token, pagination).await
    }

    async fn create_task_list(
        &self,
        access_token: &str,
        request: CreateListRequest,
    ) -> Result<TaskList, GraphApiError> {
        self.create_task_list(access_token, request).await
    }

    async fn get_tasks(
        &self,
        access_token: &str,
        list_id: &str,
        pagination: Option<&act_core::PaginationParams>,
    ) -> Result<(Vec<Task>, Option<String>), GraphApiError> {
        self.get_tasks(access_token, list_id, pagination).await
    }

    async fn get_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<Task, GraphApiError> {
        self.get_task(access_token, list_id, task_id).await
    }

    async fn create_task(
        &self,
        access_token: &str,
        list_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, GraphApiError> {
        self.create_task(access_token, list_id, request).await
    }

    async fn patch_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        patch_data: serde_json::Value,
    ) -> Result<Task, GraphApiError> {
        self.patch_task(access_token, list_id, task_id, patch_data)
            .await
    }

    async fn update_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, GraphApiError> {
        self.update_task(access_token, list_id, task_id, request)
            .await
    }

    async fn delete_task(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<(), GraphApiError> {
        self.delete_task(access_token, list_id, task_id).await
    }

    async fn get_checklist_items(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
    ) -> Result<Vec<ChecklistItem>, GraphApiError> {
        self.get_checklist_items(access_token, list_id, task_id)
            .await
    }

    async fn create_checklist_item(
        &self,
        access_token: &str,
        list_id: &str,
        task_id: &str,
        request: CreateChecklistItemRequest,
    ) -> Result<ChecklistItem, GraphApiError> {
        self.create_checklist_item(access_token, list_id, task_id, request)
            .await
    }
}
