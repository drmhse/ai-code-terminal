use tracing_subscriber;

#[allow(dead_code)]
pub fn setup_logging() {
    // Initialize logging (tracing setup)
    tracing_subscriber::fmt::init();
}