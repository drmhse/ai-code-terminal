use axum::http::HeaderMap;
use crate::error::ServerError;
use act_core::error::CoreError;

pub fn extract_bearer_token(headers: &HeaderMap) -> Result<String, ServerError> {
    let auth_header = headers.get("authorization")
        .ok_or_else(|| ServerError(CoreError::Auth("Missing authorization header".to_string())))?;

    let auth_str = auth_header.to_str()
        .map_err(|_| ServerError(CoreError::Validation("Invalid authorization header".to_string())))?;

    if !auth_str.starts_with("Bearer ") {
        return Err(ServerError(CoreError::Validation("Authorization header must start with 'Bearer '".to_string())));
    }

    Ok(auth_str[7..].to_string())
}