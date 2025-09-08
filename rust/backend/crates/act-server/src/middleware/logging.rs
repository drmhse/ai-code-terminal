use tracing_subscriber;

pub fn setup_logging() {
    // Initialize logging (tracing setup)
    tracing_subscriber::fmt::init();
}