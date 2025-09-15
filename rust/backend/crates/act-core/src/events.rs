use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::models::{ProcessStatus, UserProcess};
use crate::repository::{ProcessOutputChunk, ProcessResourceUsage};

/// Unique identifier for domain events
pub type EventId = String;

/// Base trait for all domain events
pub trait DomainEvent: Send + Sync + Clone {
    fn event_id(&self) -> EventId;
    fn event_type(&self) -> &'static str;
    fn timestamp(&self) -> DateTime<Utc>;
    fn user_id(&self) -> &str;
    fn correlation_id(&self) -> Option<String>;
}

/// Process-related domain events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessEvent {
    ProcessCreated(ProcessCreatedEvent),
    ProcessStarted(ProcessStartedEvent),
    ProcessStopped(ProcessStoppedEvent),
    ProcessFailed(ProcessFailedEvent),
    ProcessStatusChanged(ProcessStatusChangedEvent),
    ProcessOutputReceived(ProcessOutputReceivedEvent),
    ProcessResourceLimitExceeded(ProcessResourceLimitExceededEvent),
    ProcessRestarted(ProcessRestartedEvent),
    ProcessDeleted(ProcessDeletedEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessCreatedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub command: String,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStartedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub pid: i32,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStoppedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub pid: Option<i32>,
    pub exit_code: Option<i32>,
    pub reason: ProcessStopReason,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessStopReason {
    UserRequested,
    ProcessTerminated,
    ResourceLimitExceeded,
    Timeout,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessFailedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub pid: Option<i32>,
    pub exit_code: Option<i32>,
    pub error_message: String,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStatusChangedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub old_status: ProcessStatus,
    pub new_status: ProcessStatus,
    pub resource_usage: Option<ProcessResourceUsage>,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessOutputReceivedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub output_chunk: ProcessOutputChunk,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessResourceLimitExceededEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub pid: i32,
    pub limit_type: ResourceLimitType,
    pub current_usage: ProcessResourceUsage,
    pub action_taken: LimitAction,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceLimitType {
    Memory,
    Cpu,
    Runtime,
    FileDescriptors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LimitAction {
    Warning,
    Throttle,
    Terminate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRestartedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub old_pid: Option<i32>,
    pub new_pid: i32,
    pub restart_count: i32,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessDeletedEvent {
    pub event_id: EventId,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub process_id: String,
    pub process_name: String,
    pub correlation_id: Option<String>,
}

impl DomainEvent for ProcessEvent {
    fn event_id(&self) -> EventId {
        match self {
            ProcessEvent::ProcessCreated(e) => e.event_id.clone(),
            ProcessEvent::ProcessStarted(e) => e.event_id.clone(),
            ProcessEvent::ProcessStopped(e) => e.event_id.clone(),
            ProcessEvent::ProcessFailed(e) => e.event_id.clone(),
            ProcessEvent::ProcessStatusChanged(e) => e.event_id.clone(),
            ProcessEvent::ProcessOutputReceived(e) => e.event_id.clone(),
            ProcessEvent::ProcessResourceLimitExceeded(e) => e.event_id.clone(),
            ProcessEvent::ProcessRestarted(e) => e.event_id.clone(),
            ProcessEvent::ProcessDeleted(e) => e.event_id.clone(),
        }
    }

    fn event_type(&self) -> &'static str {
        match self {
            ProcessEvent::ProcessCreated(_) => "ProcessCreated",
            ProcessEvent::ProcessStarted(_) => "ProcessStarted",
            ProcessEvent::ProcessStopped(_) => "ProcessStopped",
            ProcessEvent::ProcessFailed(_) => "ProcessFailed",
            ProcessEvent::ProcessStatusChanged(_) => "ProcessStatusChanged",
            ProcessEvent::ProcessOutputReceived(_) => "ProcessOutputReceived",
            ProcessEvent::ProcessResourceLimitExceeded(_) => "ProcessResourceLimitExceeded",
            ProcessEvent::ProcessRestarted(_) => "ProcessRestarted",
            ProcessEvent::ProcessDeleted(_) => "ProcessDeleted",
        }
    }

    fn timestamp(&self) -> DateTime<Utc> {
        match self {
            ProcessEvent::ProcessCreated(e) => e.timestamp,
            ProcessEvent::ProcessStarted(e) => e.timestamp,
            ProcessEvent::ProcessStopped(e) => e.timestamp,
            ProcessEvent::ProcessFailed(e) => e.timestamp,
            ProcessEvent::ProcessStatusChanged(e) => e.timestamp,
            ProcessEvent::ProcessOutputReceived(e) => e.timestamp,
            ProcessEvent::ProcessResourceLimitExceeded(e) => e.timestamp,
            ProcessEvent::ProcessRestarted(e) => e.timestamp,
            ProcessEvent::ProcessDeleted(e) => e.timestamp,
        }
    }

    fn user_id(&self) -> &str {
        match self {
            ProcessEvent::ProcessCreated(e) => &e.user_id,
            ProcessEvent::ProcessStarted(e) => &e.user_id,
            ProcessEvent::ProcessStopped(e) => &e.user_id,
            ProcessEvent::ProcessFailed(e) => &e.user_id,
            ProcessEvent::ProcessStatusChanged(e) => &e.user_id,
            ProcessEvent::ProcessOutputReceived(e) => &e.user_id,
            ProcessEvent::ProcessResourceLimitExceeded(e) => &e.user_id,
            ProcessEvent::ProcessRestarted(e) => &e.user_id,
            ProcessEvent::ProcessDeleted(e) => &e.user_id,
        }
    }

    fn correlation_id(&self) -> Option<String> {
        match self {
            ProcessEvent::ProcessCreated(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessStarted(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessStopped(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessFailed(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessStatusChanged(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessOutputReceived(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessResourceLimitExceeded(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessRestarted(e) => e.correlation_id.clone(),
            ProcessEvent::ProcessDeleted(e) => e.correlation_id.clone(),
        }
    }
}

/// Event publisher trait for dependency injection
#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, event: ProcessEvent) -> crate::Result<()>;
    async fn publish_batch(&self, events: Vec<ProcessEvent>) -> crate::Result<()>;
}

/// In-memory event publisher using broadcast channels
#[derive(Clone)]
pub struct InMemoryEventPublisher {
    sender: Arc<broadcast::Sender<ProcessEvent>>,
}

impl InMemoryEventPublisher {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self {
            sender: Arc::new(sender),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ProcessEvent> {
        self.sender.subscribe()
    }
}

#[async_trait]
impl EventPublisher for InMemoryEventPublisher {
    async fn publish(&self, event: ProcessEvent) -> crate::Result<()> {
        self.sender
            .send(event)
            .map_err(|e| crate::error::CoreError::Internal(format!("Failed to publish event: {}", e)))?;
        Ok(())
    }

    async fn publish_batch(&self, events: Vec<ProcessEvent>) -> crate::Result<()> {
        for event in events {
            self.publish(event).await?;
        }
        Ok(())
    }
}

/// Helper functions to create events
pub fn create_process_created_event(
    user_id: &str,
    process: &UserProcess,
    correlation_id: Option<String>,
) -> ProcessEvent {
    ProcessEvent::ProcessCreated(ProcessCreatedEvent {
        event_id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_id: user_id.to_string(),
        process_id: process.id.clone(),
        process_name: process.name.clone(),
        command: process.command.clone(),
        workspace_id: process.workspace_id.clone(),
        session_id: process.session_id.clone(),
        correlation_id,
    })
}

pub fn create_process_started_event(
    user_id: &str,
    process: &UserProcess,
    pid: i32,
    correlation_id: Option<String>,
) -> ProcessEvent {
    ProcessEvent::ProcessStarted(ProcessStartedEvent {
        event_id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_id: user_id.to_string(),
        process_id: process.id.clone(),
        process_name: process.name.clone(),
        pid,
        correlation_id,
    })
}

pub fn create_process_status_changed_event(
    user_id: &str,
    process: &UserProcess,
    old_status: ProcessStatus,
    new_status: ProcessStatus,
    resource_usage: Option<ProcessResourceUsage>,
    correlation_id: Option<String>,
) -> ProcessEvent {
    ProcessEvent::ProcessStatusChanged(ProcessStatusChangedEvent {
        event_id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_id: user_id.to_string(),
        process_id: process.id.clone(),
        process_name: process.name.clone(),
        old_status,
        new_status,
        resource_usage,
        correlation_id,
    })
}

pub fn create_process_output_received_event(
    user_id: &str,
    process_id: &str,
    output_chunk: ProcessOutputChunk,
    correlation_id: Option<String>,
) -> ProcessEvent {
    ProcessEvent::ProcessOutputReceived(ProcessOutputReceivedEvent {
        event_id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        user_id: user_id.to_string(),
        process_id: process_id.to_string(),
        output_chunk,
        correlation_id,
    })
}

#[cfg(test)]
mod tests {
    include!("events_tests.rs");
}