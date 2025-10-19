use crate::{
    error::ServerError, middleware::sso_auth::AuthenticatedUser, models::ApiResponse, AppState,
};
use act_domain::{CloneRequest, RepositoryQuery};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

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
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<RepositoriesResponse>>, ServerError> {
    info!(
        "Repository list requested with params: {:?} for user {}",
        params, auth_user.sso_user_id
    );

    // Get GitHub token from SSO service using the authenticated user's raw JWT
    let github_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "github")
        .await
    {
        Ok(token_response) => {
            info!("Successfully obtained GitHub token from SSO service");
            token_response.access_token
        }
        Err(e) => {
            error!("Failed to get GitHub token from SSO service: {}", e);
            return Err(ServerError::from(act_core::CoreError::Auth(format!(
                "Failed to obtain GitHub token from SSO: {}",
                e
            ))));
        }
    };

    let query = RepositoryQuery {
        page: params.page,
        per_page: params.per_page,
        sort: params.sort,
        type_filter: params.type_filter,
        search: params.search,
    };

    match state
        .domain_services
        .github_service
        .list_user_repositories(&github_token, query)
        .await
    {
        Ok(repositories) => {
            let repo_json: Vec<serde_json::Value> = repositories
                .iter()
                .map(|repo| serde_json::to_value(repo).unwrap_or(serde_json::Value::Null))
                .collect();

            let response = RepositoriesResponse {
                success: true,
                repositories: repo_json.clone(),
                total_count: repo_json.len(),
                message: None,
            };

            info!(
                "Retrieved {} repositories for user {} with SSO",
                repo_json.len(),
                auth_user.sso_user_id
            );
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
}

pub async fn get_repository_info(
    Path((owner, repo)): Path<(String, String)>,
    State(state): State<AppState>,
    auth_user: AuthenticatedUser,
) -> Result<Json<ApiResponse<RepoInfoResponse>>, ServerError> {
    info!(
        "Repository info requested for: {}/{} by user {}",
        owner, repo, auth_user.sso_user_id
    );

    // Get GitHub token from SSO service using the authenticated user's raw JWT
    let github_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "github")
        .await
    {
        Ok(token_response) => {
            info!("Successfully obtained GitHub token from SSO service");
            token_response.access_token
        }
        Err(e) => {
            error!("Failed to get GitHub token from SSO service: {}", e);
            return Err(ServerError::from(act_core::CoreError::Auth(format!(
                "Failed to obtain GitHub token from SSO: {}",
                e
            ))));
        }
    };

    match state
        .domain_services
        .github_service
        .get_repository_info(&github_token, &owner, &repo)
        .await
    {
        Ok(repository) => {
            let repo_json = serde_json::to_value(&repository).unwrap_or(serde_json::Value::Null);

            let response = RepoInfoResponse {
                success: true,
                repository: Some(repo_json),
                message: None,
            };

            info!("Retrieved repository info for {}/{} with SSO", owner, repo);
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
    auth_user: AuthenticatedUser,
    Json(request): Json<CloneRepositoryRequest>,
) -> Result<Json<ApiResponse<CloneResponse>>, ServerError> {
    info!(
        "Repository clone requested: {} -> {} for user {}",
        request.git_url, request.name, auth_user.sso_user_id
    );

    // Get GitHub token from SSO service using the authenticated user's raw JWT
    let github_token = match state
        .sso_client
        .get_provider_token(&auth_user.raw_jwt, "github")
        .await
    {
        Ok(token_response) => {
            info!("Successfully obtained GitHub token from SSO service");
            token_response.access_token
        }
        Err(e) => {
            error!("Failed to get GitHub token from SSO service: {}", e);
            return Err(ServerError::from(act_core::CoreError::Auth(format!(
                "Failed to obtain GitHub token from SSO: {}",
                e
            ))));
        }
    };

    let clone_request = CloneRequest {
        name: request.name,
        git_url: request.git_url,
        branch: request.branch,
        description: request.description,
    };

    match state
        .domain_services
        .workspace_service
        .clone_repository(&auth_user.db_user_id, clone_request, Some(&github_token))
        .await
    {
        Ok(workspace) => {
            let workspace_json =
                serde_json::to_value(&workspace).unwrap_or(serde_json::Value::Null);

            let response = CloneResponse {
                success: true,
                workspace: Some(workspace_json),
                message: None,
            };

            info!("Repository cloned successfully with SSO: {}", workspace.id);
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
}
