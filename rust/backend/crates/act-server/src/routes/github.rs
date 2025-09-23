use crate::{AppState, models::ApiResponse, error::ServerError, utils::extract_bearer_token};
use axum::{
    extract::{Query, State, Path},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use act_domain::{RepositoryQuery, CloneRequest};

#[derive(Debug, Deserialize)]
pub struct RepoQuery {
    page: Option<u32>,
    per_page: Option<u32>,
    sort: Option<String>,
    #[serde(rename = "type")]
    type_filter: Option<String>,
    search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepositoriesResponse {
    success: bool,
    repositories: Vec<serde_json::Value>,
    total_count: usize,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepoInfoResponse {
    success: bool,
    repository: Option<serde_json::Value>,
    message: Option<String>,
}

pub async fn list_repositories(
    Query(params): Query<RepoQuery>,
    State(state): State<AppState>,
    headers: HeaderMap
) -> Result<Json<ApiResponse<RepositoriesResponse>>, ServerError> {
    info!("Repository list requested with params: {:?}", params);

    let token = extract_bearer_token(&headers)?;
    
    match state.domain_services.auth_service.get_current_user(&token).await {
        Ok(user) => {
            let query = RepositoryQuery {
                page: params.page,
                per_page: params.per_page,
                sort: params.sort,
                type_filter: params.type_filter,
                search: params.search,
            };

            match state.domain_services.github_service.list_user_repositories(&user.user_id, query).await {
                Ok(repositories) => {
                    let repo_json: Vec<serde_json::Value> = repositories.iter()
                        .map(|repo| serde_json::to_value(repo).unwrap_or(serde_json::Value::Null))
                        .collect();
                    
                    let response = RepositoriesResponse {
                        success: true,
                        repositories: repo_json.clone(),
                        total_count: repo_json.len(),
                        message: None,
                    };
                    
                    info!("Retrieved {} repositories for user {}", repo_json.len(), user.username);
                    Ok(Json(ApiResponse::success(response)))
                }
                Err(e) => {
                    error!("Failed to fetch repositories: {}", e);
                    // If it's an Auth error, propagate it as 401 to trigger re-login
                    if matches!(e, act_core::CoreError::Auth(_)) {
                        return Err(ServerError::from(e));
                    }
                    let response = RepositoriesResponse {
                        success: false,
                        repositories: vec![],
                        total_count: 0,
                        message: Some(format!("Failed to fetch repositories: {}", e)),
                    };
                    Ok(Json(ApiResponse::success(response)))
                }
            }
        },
        Err(e) => {
            error!("Failed to authenticate user: {}", e);
            Err(ServerError::from(e))
        }
    }
}

pub async fn get_repository_info(
    Path((owner, repo)): Path<(String, String)>,
    State(state): State<AppState>,
    headers: HeaderMap
) -> Result<Json<ApiResponse<RepoInfoResponse>>, ServerError> {
    info!("Repository info requested for: {}/{}", owner, repo);

    let token = extract_bearer_token(&headers)?;
    
    match state.domain_services.auth_service.get_current_user(&token).await {
        Ok(user) => {
            match state.domain_services.github_service.get_repository_info(&user.user_id, &owner, &repo).await {
                Ok(repository) => {
                    let repo_json = serde_json::to_value(&repository).unwrap_or(serde_json::Value::Null);
                    
                    let response = RepoInfoResponse {
                        success: true,
                        repository: Some(repo_json),
                        message: None,
                    };
                    
                    info!("Retrieved repository info for {}/{}", owner, repo);
                    Ok(Json(ApiResponse::success(response)))
                }
                Err(e) => {
                    error!("Failed to fetch repository info: {}", e);
                    // If it's an Auth error, propagate it as 401 to trigger re-login
                    if matches!(e, act_core::CoreError::Auth(_)) {
                        return Err(ServerError::from(e));
                    }
                    let response = RepoInfoResponse {
                        success: false,
                        repository: None,
                        message: Some(format!("Failed to fetch repository info: {}", e)),
                    };
                    Ok(Json(ApiResponse::success(response)))
                }
            }
        },
        Err(e) => {
            error!("Failed to authenticate user: {}", e);
            Err(ServerError::from(e))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CloneRepositoryRequest {
    pub name: String,
    pub git_url: String,
    pub branch: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CloneResponse {
    success: bool,
    workspace: Option<serde_json::Value>,
    message: Option<String>,
}

pub async fn clone_repository(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CloneRepositoryRequest>
) -> Result<Json<ApiResponse<CloneResponse>>, ServerError> {
    info!("Repository clone requested: {} -> {}", request.git_url, request.name);

    let token = extract_bearer_token(&headers)?;
    
    match state.domain_services.auth_service.get_current_user(&token).await {
        Ok(user) => {
            // Get the user's GitHub token for authenticated cloning - this is done automatically by the workspace service
            // as it uses the auth repository to get the token when needed
            let github_token: Option<String> = None; // Let the workspace service handle token retrieval

            let clone_request = CloneRequest {
                name: request.name,
                git_url: request.git_url,
                branch: request.branch,
                description: request.description,
            };

            match state.domain_services.workspace_service.clone_repository(&user.user_id, clone_request, github_token.as_deref()).await {
                Ok(workspace) => {
                    let workspace_json = serde_json::to_value(&workspace).unwrap_or(serde_json::Value::Null);
                    
                    let response = CloneResponse {
                        success: true,
                        workspace: Some(workspace_json),
                        message: None,
                    };
                    
                    info!("Repository cloned successfully: {}", workspace.id);
                    Ok(Json(ApiResponse::success(response)))
                }
                Err(e) => {
                    error!("Failed to clone repository: {}", e);
                    // If it's an Auth error, propagate it as 401 to trigger re-login
                    if matches!(e, act_core::CoreError::Auth(_)) {
                        return Err(ServerError::from(e));
                    }
                    let response = CloneResponse {
                        success: false,
                        workspace: None,
                        message: Some(format!("Failed to clone repository: {}", e)),
                    };
                    Ok(Json(ApiResponse::success(response)))
                }
            }
        },
        Err(e) => {
            error!("Failed to authenticate user: {}", e);
            Err(ServerError::from(e))
        }
    }
}

