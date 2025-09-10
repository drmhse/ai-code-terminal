use act_core::CoreError;
use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};
use serde_json::json;

/// Wrapper type for CoreError to implement IntoResponse in our crate
pub struct ServerError(pub CoreError);

impl From<CoreError> for ServerError {
    fn from(err: CoreError) -> Self {
        ServerError(err)
    }
}

/// Convert CoreError to HTTP response
impl IntoResponse for ServerError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self.0 {
            CoreError::NotFound(_) => (StatusCode::NOT_FOUND, "Resource not found"),
            CoreError::Validation(msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
            CoreError::PermissionDenied(_) => (StatusCode::FORBIDDEN, "Permission denied"),
            CoreError::Conflict(msg) => (StatusCode::CONFLICT, msg.as_str()),
            CoreError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
            CoreError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            CoreError::Pty(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Terminal error"),
            CoreError::FileSystem(_) => (StatusCode::INTERNAL_SERVER_ERROR, "File system error"),
            CoreError::Config(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Configuration error"),
            CoreError::Auth(_) => (StatusCode::UNAUTHORIZED, "Authentication error"),
            CoreError::Serialization(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Serialization error"),
            CoreError::Network(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Network error"),
            CoreError::Timeout(_) => (StatusCode::REQUEST_TIMEOUT, "Request timeout"),
            CoreError::ServiceUnavailable(_) => (StatusCode::SERVICE_UNAVAILABLE, "Service unavailable"),
            CoreError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.as_str()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };

        let body = Json(json!({
            "error": {
                "code": status.as_u16(),
                "message": error_message,
                "details": self.0.to_string()
            }
        }));

        (status, body).into_response()
    }
}