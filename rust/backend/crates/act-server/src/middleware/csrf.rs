use axum::{
    extract::Request,
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

/// CSRF protection middleware using double-submit cookie pattern
pub struct CsrfProtection {
    _secret: String, // Keep for future use, even if not currently accessed
}

impl CsrfProtection {
    pub fn new(secret: String) -> Self {
        Self { _secret: secret }
    }

    /// Generate a new CSRF token
    pub fn generate_token(&self) -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let token: String = (0..32)
            .map(|_| rng.sample(rand::distributions::Alphanumeric) as char)
            .collect();
        token
    }

    /// Verify CSRF token for state-changing requests
    pub async fn verify_csrf(request: Request, next: Next) -> Result<Response, StatusCode> {
        // Skip CSRF verification for safe methods
        if matches!(
            request.method(),
            &Method::GET | &Method::HEAD | &Method::OPTIONS
        ) {
            return Ok(next.run(request).await);
        }

        // Skip CSRF verification for API requests with Authorization header
        // This allows legitimate API calls from different origins
        if request.headers().get("authorization").is_some() {
            return Ok(next.run(request).await);
        }

        // Extract CSRF token from header
        let csrf_token = request
            .headers()
            .get("X-CSRF-Token")
            .and_then(|value| value.to_str().ok())
            .ok_or(StatusCode::FORBIDDEN)?;

        // Extract CSRF token from cookie
        let cookie_token = request
            .headers()
            .get("cookie")
            .and_then(|cookie| cookie.to_str().ok())
            .and_then(|cookie_str| {
                cookie_str.split(';').find_map(|s| {
                    let parts: Vec<&str> = s.trim().splitn(2, '=').collect();
                    if parts.len() == 2 && parts[0].trim() == "csrf_token" {
                        Some(parts[1].trim())
                    } else {
                        None
                    }
                })
            })
            .ok_or(StatusCode::FORBIDDEN)?;

        // Verify that the header token matches the cookie token
        use constant_time_eq::constant_time_eq;
        if !constant_time_eq(csrf_token.as_bytes(), cookie_token.as_bytes()) {
            return Err(StatusCode::FORBIDDEN);
        }

        Ok(next.run(request).await)
    }
}

/// Helper to extract CSRF token from request
#[allow(dead_code)]
pub fn extract_csrf_token(req: &Request) -> Option<&str> {
    req.headers()
        .get("X-CSRF-Token")
        .and_then(|value| value.to_str().ok())
}

/// Helper to check if request requires CSRF protection
#[allow(dead_code)]
pub fn requires_csrf_protection(method: &Method) -> bool {
    matches!(
        method,
        &Method::POST | &Method::PUT | &Method::DELETE | &Method::PATCH
    )
}

/// CSRF error response
#[allow(dead_code)]
pub fn csrf_error_response() -> impl IntoResponse {
    (StatusCode::FORBIDDEN, "CSRF token validation failed")
}
