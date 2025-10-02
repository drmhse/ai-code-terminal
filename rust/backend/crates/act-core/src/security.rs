use crate::error::CoreError;
use crate::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// Security configuration for process execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSecurityConfig {
    pub allowed_commands: Option<HashSet<String>>,
    pub blocked_commands: HashSet<String>,
    pub allowed_command_patterns: Vec<String>,
    pub blocked_command_patterns: Vec<String>,
    pub allowed_working_directories: Vec<PathBuf>,
    pub blocked_working_directories: Vec<PathBuf>,
    pub max_command_length: usize,
    pub max_args_count: usize,
    pub max_arg_length: usize,
    pub allowed_environment_variables: Option<HashSet<String>>,
    pub blocked_environment_variables: HashSet<String>,
    pub require_safe_commands_only: bool,
    pub enable_path_traversal_protection: bool,
}

impl Default for ProcessSecurityConfig {
    fn default() -> Self {
        Self {
            allowed_commands: None, // None means allow all not explicitly blocked
            blocked_commands: [
                // Dangerous system commands
                "rm",
                "rmdir",
                "del",
                "format",
                "fdisk",
                "mkfs",
                "dd",
                "shred",
                "wipefs",
                "parted",
                "gparted",
                // Network/security tools
                "nc",
                "netcat",
                "nmap",
                "telnet",
                "ssh",
                "scp",
                "rsync",
                "wget",
                "curl",
                "ftp",
                "sftp",
                "tftp",
                // System modification
                "chmod",
                "chown",
                "chgrp",
                "mount",
                "umount",
                "systemctl",
                "service",
                "crontab",
                "at",
                // Package managers (can be dangerous)
                "apt",
                "yum",
                "dnf",
                "pacman",
                "zypper",
                "emerge",
                "pip",
                "npm",
                "gem",
                "cargo",
                "go",
                // Interpreters (to prevent arbitrary code execution)
                "python",
                "python3",
                "node",
                "ruby",
                "perl",
                "php",
                "bash",
                "sh",
                "zsh",
                "fish",
                "powershell",
                "cmd",
            ]
            .iter()
            .map(|s| s.to_string())
            .collect(),
            allowed_command_patterns: vec![
                // Allow common development tools
                r"^(git|make|cmake|ninja|docker|kubectl)$".to_string(),
                // Allow safe listing and viewing commands
                r"^(ls|dir|cat|less|more|head|tail|grep|find|which)$".to_string(),
                // Allow text editors
                r"^(vim|nvim|nano|emacs|code|code-insiders)$".to_string(),
            ],
            blocked_command_patterns: vec![
                // Block any command with dangerous flags
                r".*\s+(-r|-R|--recursive|--force|-f|--delete).*".to_string(),
                // Block command chaining
                r".*[;&|`$()].*".to_string(),
                // Block redirection
                r".*[><].*".to_string(),
            ],
            allowed_working_directories: vec![
                PathBuf::from("/tmp"),
                PathBuf::from("/home"),
                PathBuf::from("/Users"),
                PathBuf::from("/workspace"),
                PathBuf::from("/project"),
            ],
            blocked_working_directories: vec![
                PathBuf::from("/"),
                PathBuf::from("/bin"),
                PathBuf::from("/sbin"),
                PathBuf::from("/usr/bin"),
                PathBuf::from("/usr/sbin"),
                PathBuf::from("/etc"),
                PathBuf::from("/sys"),
                PathBuf::from("/proc"),
                PathBuf::from("/dev"),
                PathBuf::from("/boot"),
            ],
            max_command_length: 256,
            max_args_count: 50,
            max_arg_length: 1024,
            allowed_environment_variables: None, // None means allow all not explicitly blocked
            blocked_environment_variables: [
                // Dangerous environment variables
                "LD_PRELOAD",
                "LD_LIBRARY_PATH",
                "DYLD_INSERT_LIBRARIES",
                "DYLD_LIBRARY_PATH",
                "PATH",
                "PYTHONPATH",
                "NODE_PATH",
                // Security-related
                "SSH_AUTH_SOCK",
                "SSH_AGENT_PID",
                "GPG_AGENT_INFO",
                "SUDO_USER",
                "SUDO_UID",
                "SUDO_GID",
            ]
            .iter()
            .map(|s| s.to_string())
            .collect(),
            require_safe_commands_only: true,
            enable_path_traversal_protection: true,
        }
    }
}

/// Security validator for process commands and arguments
#[derive(Debug, Clone)]
pub struct ProcessSecurityValidator {
    config: ProcessSecurityConfig,
    allowed_patterns: Vec<Regex>,
    blocked_patterns: Vec<Regex>,
}

impl ProcessSecurityValidator {
    pub fn new(config: ProcessSecurityConfig) -> Result<Self> {
        let allowed_patterns = config
            .allowed_command_patterns
            .iter()
            .map(|pattern| Regex::new(pattern))
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| {
                CoreError::Validation(format!("Invalid allowed command pattern: {}", e))
            })?;

        let blocked_patterns = config
            .blocked_command_patterns
            .iter()
            .map(|pattern| Regex::new(pattern))
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| {
                CoreError::Validation(format!("Invalid blocked command pattern: {}", e))
            })?;

        Ok(Self {
            config,
            allowed_patterns,
            blocked_patterns,
        })
    }

    pub fn validate_process_request(
        &self,
        command: &str,
        args: &[String],
        working_directory: &str,
        environment_variables: &HashMap<String, String>,
    ) -> Result<()> {
        self.validate_command(command)?;
        self.validate_arguments(args)?;
        self.validate_working_directory(working_directory, None)?;
        self.validate_environment_variables(environment_variables)?;
        self.validate_combined_command(command, args)?;

        Ok(())
    }

    /// Validates a process request with workspace-scoped security
    ///
    /// This method enforces that all process operations stay within the workspace root,
    /// providing a "jailed" environment for better security and isolation.
    pub fn validate_process_request_with_workspace(
        &self,
        command: &str,
        args: &[String],
        working_directory: &str,
        environment_variables: &HashMap<String, String>,
        workspace_root: &Path,
    ) -> Result<()> {
        self.validate_command(command)?;
        self.validate_arguments(args)?;
        self.validate_working_directory(working_directory, Some(workspace_root))?;
        self.validate_environment_variables(environment_variables)?;
        self.validate_combined_command(command, args)?;

        Ok(())
    }

    fn validate_command(&self, command: &str) -> Result<()> {
        // Check command length
        if command.len() > self.config.max_command_length {
            return Err(CoreError::Validation(format!(
                "Command too long: {} characters (max: {})",
                command.len(),
                self.config.max_command_length
            )));
        }

        // Check for null bytes or other dangerous characters
        if command.contains('\0') || command.contains('\n') || command.contains('\r') {
            return Err(CoreError::Validation(
                "Command contains invalid characters".to_string(),
            ));
        }

        // Extract just the command name (first part before any spaces)
        let command_name = command.split_whitespace().next().unwrap_or(command);
        let base_command = Path::new(command_name)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(command_name);

        // Check against blocked commands
        if self.config.blocked_commands.contains(base_command) {
            return Err(CoreError::Validation(format!(
                "Command '{}' is not allowed",
                base_command
            )));
        }

        // If we have an allowlist, check it
        if let Some(ref allowed) = self.config.allowed_commands {
            if !allowed.contains(base_command) {
                return Err(CoreError::Validation(format!(
                    "Command '{}' is not in the allowlist",
                    base_command
                )));
            }
        }

        // Check against blocked patterns
        for pattern in &self.blocked_patterns {
            if pattern.is_match(command) {
                return Err(CoreError::Validation(format!(
                    "Command matches blocked pattern: {}",
                    pattern.as_str()
                )));
            }
        }

        // If safe commands only is enabled, check allowed patterns
        if self.config.require_safe_commands_only {
            let matches_allowed = self
                .allowed_patterns
                .iter()
                .any(|pattern| pattern.is_match(base_command));

            if !matches_allowed {
                return Err(CoreError::Validation(format!(
                    "Command '{}' does not match any allowed pattern",
                    base_command
                )));
            }
        }

        Ok(())
    }

    fn validate_arguments(&self, args: &[String]) -> Result<()> {
        // Check argument count
        if args.len() > self.config.max_args_count {
            return Err(CoreError::Validation(format!(
                "Too many arguments: {} (max: {})",
                args.len(),
                self.config.max_args_count
            )));
        }

        for (i, arg) in args.iter().enumerate() {
            // Check argument length
            if arg.len() > self.config.max_arg_length {
                return Err(CoreError::Validation(format!(
                    "Argument {} too long: {} characters (max: {})",
                    i,
                    arg.len(),
                    self.config.max_arg_length
                )));
            }

            // Check for null bytes or other dangerous characters
            if arg.contains('\0') {
                return Err(CoreError::Validation(format!(
                    "Argument {} contains null bytes",
                    i
                )));
            }

            // Check for path traversal if protection is enabled
            if self.config.enable_path_traversal_protection
                && (arg.contains("../") || arg.contains("..\\"))
            {
                return Err(CoreError::Validation(format!(
                    "Argument {} contains path traversal: {}",
                    i, arg
                )));
            }

            // Check for command injection patterns
            if arg.contains(';')
                || arg.contains('|')
                || arg.contains('&')
                || arg.contains('`')
                || arg.contains('$')
                || arg.contains('(')
            {
                return Err(CoreError::Validation(format!(
                    "Argument {} contains potentially dangerous characters: {}",
                    i, arg
                )));
            }
        }

        Ok(())
    }

    /// Validates a working directory path for security.
    ///
    /// # Security Checks
    /// - Path traversal prevention
    /// - Blocked directory enforcement
    /// - Symlink resolution and validation
    /// - Workspace root jailing (if provided)
    ///
    /// # Path Existence Handling
    /// If the path does not exist, the parent directory is validated instead.
    /// This allows for creating new directories within validated paths.
    ///
    /// # Arguments
    /// - `working_dir`: The directory path to validate (may not exist)
    /// - `workspace_root`: Optional workspace root for jailing (must exist)
    fn validate_working_directory(
        &self,
        working_dir: &str,
        workspace_root: Option<&Path>,
    ) -> Result<()> {
        let path = Path::new(working_dir);

        // Check path traversal
        if self.config.enable_path_traversal_protection
            && (working_dir.contains("../") || working_dir.contains("..\\"))
        {
            return Err(CoreError::Validation(format!(
                "Working directory contains path traversal: {}",
                working_dir
            )));
        }

        // Pre-canonicalization check: ensure the original path doesn't start with blocked directories
        // This prevents symlink bypass where a symlink outside blocked dirs points to a blocked dir
        for blocked_dir in &self.config.blocked_working_directories {
            if path.starts_with(blocked_dir) {
                return Err(CoreError::Validation(format!(
                    "Working directory '{}' is not allowed (pre-canonicalization check)",
                    working_dir
                )));
            }
        }

        // Handle path existence: if path doesn't exist, validate parent instead
        let (path_to_validate, is_parent) = if path.exists() {
            (path, false)
        } else {
            // Get parent directory - if no parent, use current dir
            let parent = path.parent().unwrap_or_else(|| Path::new("."));
            if !parent.exists() {
                return Err(CoreError::Validation(format!(
                    "Parent directory of '{}' does not exist",
                    working_dir
                )));
            }
            (parent, true)
        };

        // Canonicalize paths to resolve symlinks and relative paths
        let canonical_path = std::fs::canonicalize(path_to_validate).map_err(|e| {
            CoreError::Validation(format!(
                "Failed to resolve working directory '{}': {}",
                path_to_validate.display(),
                e
            ))
        })?;

        // Detect if path is a symlink - additional security measure
        if path.is_symlink() {
            // Symlinks are allowed, but we verify both original and resolved paths
            tracing::warn!(
                "Working directory '{}' is a symlink, resolves to '{}'",
                working_dir,
                canonical_path.display()
            );
        }

        // If workspace_root is provided, enforce workspace jailing
        if let Some(workspace_root) = workspace_root {
            // Pre-canonicalization check: ensure original path is within workspace
            // Use the path we're actually validating (parent if path doesn't exist)
            if !path_to_validate.starts_with(workspace_root) {
                return Err(CoreError::Validation(
                    format!("Working directory '{}' is outside workspace root '{}' (pre-canonicalization check)",
                           working_dir, workspace_root.display())
                ));
            }

            // Canonicalize workspace root to handle symlinks
            let canonical_workspace = std::fs::canonicalize(workspace_root).map_err(|e| {
                CoreError::Validation(format!("Failed to resolve workspace root: {}", e))
            })?;

            // Ensure canonicalized working directory is still within workspace root
            // This catches symlinks that point outside the workspace
            if !canonical_path.starts_with(&canonical_workspace) {
                return Err(CoreError::Validation(format!(
                    "Working directory '{}' resolves to '{}' which is outside workspace root '{}'",
                    working_dir,
                    canonical_path.display(),
                    workspace_root.display()
                )));
            }
        }

        if is_parent {
            tracing::debug!(
                "Validated parent directory '{}' for non-existent path '{}'",
                path_to_validate.display(),
                working_dir
            );
        }

        // Check against blocked directories (always enforced)
        for blocked_dir in &self.config.blocked_working_directories {
            if canonical_path.starts_with(blocked_dir) {
                return Err(CoreError::Validation(format!(
                    "Working directory '{}' is not allowed",
                    working_dir
                )));
            }
        }

        // Check against allowed directories only if no workspace_root is provided
        // and the allowed list is not empty
        if workspace_root.is_none() && !self.config.allowed_working_directories.is_empty() {
            let is_allowed = self
                .config
                .allowed_working_directories
                .iter()
                .any(|allowed_dir| canonical_path.starts_with(allowed_dir));

            if !is_allowed {
                return Err(CoreError::Validation(format!(
                    "Working directory '{}' is not in allowed list",
                    working_dir
                )));
            }
        }

        Ok(())
    }

    fn validate_environment_variables(&self, env_vars: &HashMap<String, String>) -> Result<()> {
        for (key, value) in env_vars {
            // Check against blocked environment variables
            if self.config.blocked_environment_variables.contains(key) {
                return Err(CoreError::Validation(format!(
                    "Environment variable '{}' is not allowed",
                    key
                )));
            }

            // If we have an allowlist, check it
            if let Some(ref allowed) = self.config.allowed_environment_variables {
                if !allowed.contains(key) {
                    return Err(CoreError::Validation(format!(
                        "Environment variable '{}' is not in allowlist",
                        key
                    )));
                }
            }

            // Check for dangerous values
            if value.contains('\0') || value.len() > 4096 {
                return Err(CoreError::Validation(format!(
                    "Environment variable '{}' has invalid value",
                    key
                )));
            }

            // Check for command injection in environment variable values
            if value.contains(';')
                || value.contains('|')
                || value.contains('&')
                || value.contains('`')
                || value.contains('$')
                || value.contains('(')
            {
                return Err(CoreError::Validation(format!(
                    "Environment variable '{}' value contains dangerous characters",
                    key
                )));
            }
        }

        Ok(())
    }

    fn validate_combined_command(&self, command: &str, args: &[String]) -> Result<()> {
        // Check the full command line for dangerous patterns
        let full_command = if args.is_empty() {
            command.to_string()
        } else {
            format!("{} {}", command, args.join(" "))
        };

        // Check for shell metacharacters that could be used for injection
        let dangerous_chars = ['&', '|', ';', '`', '$', '(', ')', '<', '>', '\n', '\r'];
        if full_command.chars().any(|c| dangerous_chars.contains(&c)) {
            return Err(CoreError::Validation(
                "Command contains shell metacharacters that could be dangerous".to_string(),
            ));
        }

        // Check for common injection patterns
        let injection_patterns = [
            "$(",
            "${",
            "`",
            "||",
            "&&",
            ">>",
            "<<",
            "2>&1",
            "/dev/null",
            "/dev/zero",
            "/proc/",
        ];

        for pattern in &injection_patterns {
            if full_command.contains(pattern) {
                return Err(CoreError::Validation(format!(
                    "Command contains potentially dangerous pattern: {}",
                    pattern
                )));
            }
        }

        Ok(())
    }
}

/// Security audit log entry for process operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSecurityAuditEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub user_id: String,
    pub process_id: Option<String>,
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub action: SecurityAction,
    pub result: SecurityResult,
    pub reason: Option<String>,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityAction {
    ProcessCreate,
    ProcessStart,
    ProcessStop,
    ProcessRestart,
    CommandValidation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityResult {
    Allowed,
    Blocked,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Security audit logger trait
pub trait SecurityAuditLogger: Send + Sync {
    fn log_security_event(&self, entry: ProcessSecurityAuditEntry);
}

/// In-memory security audit logger for development/testing
#[derive(Default)]
pub struct InMemorySecurityAuditLogger {
    entries: std::sync::Arc<std::sync::Mutex<Vec<ProcessSecurityAuditEntry>>>,
}

impl InMemorySecurityAuditLogger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_entries(&self) -> Vec<ProcessSecurityAuditEntry> {
        self.entries.lock().unwrap().clone()
    }

    pub fn clear(&self) {
        self.entries.lock().unwrap().clear();
    }
}

impl SecurityAuditLogger for InMemorySecurityAuditLogger {
    fn log_security_event(&self, entry: ProcessSecurityAuditEntry) {
        self.entries.lock().unwrap().push(entry);
    }
}

#[cfg(test)]
mod tests {
    include!("security_tests.rs");
}
