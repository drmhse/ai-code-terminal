use crate::{AppState, services::{GitHubService, SettingsService}, models::ApiResponse};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};
use jsonwebtoken::{decode, DecodingKey, Validation};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    pub sub: String,
    pub username: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Deserialize)]
pub struct RepoQuery {
    page: Option<u32>,
    per_page: Option<u32>,
    sort: Option<String>,
    #[serde(rename = "type")]
    type_filter: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepositoriesResponse {
    success: bool,
    data: RepositoriesData,
    pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct RepositoriesData {
    repositories: Vec<crate::services::github::GitHubRepository>,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    page: u32,
    per_page: u32,
    has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct RepositoryResponse {
    success: bool,
    repository: crate::services::github::GitHubRepository,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    success: bool,
    error: String,
    message: String,
}

/// Get user repositories
pub async fn get_repositories(
    Query(params): Query<RepoQuery>,
    State(state): State<AppState>
) -> Result<Json<RepositoriesResponse>, axum::response::Response<axum::body::Body>> {
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            create_error_response(500, "Internal server error", &e.to_string())
        })?;
    
    let settings_service = SettingsService::new(state.db.clone());
    
    // Get access token
    let access_token = match settings_service.get_github_token(&github_service).await {
        Ok(Some(token)) => token,
        Ok(None) => return Err(create_error_response(401, "Not authenticated", "GitHub token not found")),
        Err(e) => {
            error!("Failed to get GitHub token: {}", e);
            return Err(create_error_response(500, "Failed to get GitHub token", &e.to_string()));
        }
    };

    // Validate token is still valid
    if !github_service.validate_token(&access_token).await {
        // Try to refresh token
        if let Ok(Some(refresh_token)) = settings_service.get_github_refresh_token(&github_service).await {
            match github_service.refresh_access_token(&refresh_token).await {
                Ok(new_token_result) => {
                    // Update stored tokens
                    if let Err(e) = settings_service.update_github_tokens(
                        &github_service,
                        Some(&new_token_result.access_token),
                        new_token_result.refresh_token.as_deref(),
                        Some(new_token_result.expires_at)
                    ).await {
                        error!("Failed to store refreshed tokens: {}", e);
                        return Err(create_error_response(500, "Token refresh failed", &e.to_string()));
                    }
                    info!("GitHub token refreshed successfully");
                }
                Err(e) => {
                    warn!("Token refresh failed: {}", e);
                    return Err(create_error_response(401, "Re-authentication required", &e.to_string()));
                }
            }
        } else {
            return Err(create_error_response(401, "Re-authentication required", "Token expired and no refresh token available"));
        }
    }

    // Get repositories
    let repositories = match github_service.get_user_repositories(
        &access_token,
        params.page,
        params.per_page,
        params.sort.as_deref(),
        params.type_filter.as_deref()
    ).await {
        Ok(repos) => repos,
        Err(e) => {
            error!("Failed to get repositories: {}", e);
            return Err(create_error_response(500, "Failed to get repositories", &e.to_string()));
        }
    };

    let page = params.page.unwrap_or(1);
    let per_page = params.per_page.unwrap_or(30);
    let has_more = repositories.len() == per_page as usize;

    Ok(Json(RepositoriesResponse {
        success: true,
        data: RepositoriesData {
            repositories,
        },
        pagination: PaginationInfo {
            page,
            per_page,
            has_more,
        }
    }))
}

/// Get specific repository information
pub async fn get_repository(
    Path((owner, repo)): Path<(String, String)>,
    State(state): State<AppState>
) -> Result<Json<RepositoryResponse>, axum::response::Response<axum::body::Body>> {
    let github_service = GitHubService::new(Arc::new(state.config.clone()))
        .map_err(|e| {
            error!("Failed to initialize GitHub service: {}", e);
            create_error_response(500, "Internal server error", &e.to_string())
        })?;
    
    let settings_service = SettingsService::new(state.db.clone());
    
    // Get access token
    let access_token = match settings_service.get_github_token(&github_service).await {
        Ok(Some(token)) => token,
        Ok(None) => return Err(create_error_response(401, "Not authenticated", "GitHub token not found")),
        Err(e) => {
            error!("Failed to get GitHub token: {}", e);
            return Err(create_error_response(500, "Failed to get GitHub token", &e.to_string()));
        }
    };

    // Get repository info
    let repository = match github_service.get_repository_info(&access_token, &owner, &repo).await {
        Ok(repo) => repo,
        Err(e) => {
            error!("Failed to get repository info: {}", e);
            return Err(create_error_response(500, "Failed to get repository information", &e.to_string()));
        }
    };

    Ok(Json(RepositoryResponse {
        success: true,
        repository,
    }))
}

fn create_error_response(status: u16, error: &str, message: &str) -> axum::response::Response<axum::body::Body> {
    let error_response = ErrorResponse {
        success: false,
        error: error.to_string(),
        message: message.to_string(),
    };
    
    axum::response::Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&error_response).unwrap()))
        .unwrap()
}

#[derive(Debug, Deserialize)]
pub struct CloneRequest {
    pub clone_url: String,
    pub name: String,
}

/// Clone a repository and create a workspace
pub async fn clone_repository(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CloneRequest>
) -> Result<Json<ApiResponse<serde_json::Value>>, axum::response::Response<axum::body::Body>> {
    info!("Repository clone requested: {} -> {}", request.clone_url, request.name);
    
    // Extract user ID from JWT token
    let auth_header = headers.get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| create_error_response(401, "Missing authorization header", "Authorization header is required"))?;
        
    let token = auth_header.strip_prefix("Bearer ")
        .ok_or_else(|| create_error_response(401, "Invalid authorization format", "Authorization header must start with 'Bearer '"))?;
    
    let jwt_secret = std::env::var("ACT_AUTH_JWT_SECRET")
        .map_err(|_| create_error_response(500, "Internal server error", "JWT configuration missing"))?;
    
    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default()
    )
    .map_err(|_| create_error_response(401, "Invalid token", "Failed to decode JWT token"))?
    .claims;
    
    let github_service = match GitHubService::new(Arc::new(state.config.clone())) {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize GitHub service: {}", e);
            return Err(create_error_response(500, "Internal server error", &e.to_string()));
        }
    };
    
    let settings_service = SettingsService::new(state.db.clone());
    
    // Get access token
    let access_token = match settings_service.get_github_token(&github_service).await {
        Ok(Some(token)) => token,
        Ok(None) => return Err(create_error_response(401, "Not authenticated", "GitHub token not found")),
        Err(e) => {
            error!("Failed to get GitHub token: {}", e);
            return Err(create_error_response(500, "Failed to get GitHub token", &e.to_string()));
        }
    };
    
    // Validate token is still valid
    if !github_service.validate_token(&access_token).await {
        return Err(create_error_response(401, "Token expired", "GitHub token has expired"));
    }
    
    // Use the workspace service to clone the repository
    use crate::services::workspace::{WorkspaceService, CloneRequest as WorkspaceCloneRequest};
    use std::path::PathBuf;
    
    let workspace_root = PathBuf::from("./workspaces");
    let workspace_service = WorkspaceService::new(state.db.clone(), workspace_root);
    
    let clone_request = WorkspaceCloneRequest {
        git_url: request.clone_url,
        name: request.name,
        branch: None, // TODO: Allow specifying branch in request
        description: None, // TODO: Allow specifying description in request
        owner_id: claims.sub, // Use actual user ID from JWT token
    };
    
    match workspace_service.clone_repository(clone_request, &access_token).await {
        Ok(workspace) => {
            info!("Repository cloned successfully: {}", workspace.id);
            let workspace_json = serde_json::to_value(workspace).map_err(|e| {
                error!("Failed to serialize workspace: {}", e);
                create_error_response(500, "Internal server error", &e.to_string())
            })?;
            Ok(Json(ApiResponse::success(workspace_json)))
        },
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("is already cloned for this user") {
                error!("Repository already exists: {}", e);
                Err(create_error_response(409, "Repository already exists", &error_msg))
            } else {
                error!("Failed to clone repository: {}", e);
                Err(create_error_response(500, "Failed to clone repository", &error_msg))
            }
        }
    }
}