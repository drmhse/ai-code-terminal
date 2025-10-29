# Security Policy

## Supported Versions

Security updates are provided for the following versions of Act CLI:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Considerations

### Command Execution

Act CLI executes commands through the `--exec` flag and AI backend integration. Security measures include:

- Input validation to prevent command injection
- Restricted character set for command execution
- No privilege escalation requirements
- Sandboxed execution environment

### File System Access

The tool operates on user files and directories with the following protections:

- Path validation to prevent directory traversal
- File size limits to prevent resource exhaustion
- Read-only access to user files (no modification without explicit commands)
- Isolated workspace context storage

### Data Handling

- Context data is stored locally in `~/.act/context/`
- No automatic transmission of sensitive data
- User controls what information is sent to AI backends
- Context buffer can be inspected before transmission

### Configuration Security

- Configuration stored in user home directory
- No storage of credentials or API keys
- Configurable AI backend selection
- Input validation for all configuration values

## Reporting a Vulnerability

We take security seriously and appreciate responsible disclosure of security vulnerabilities.

### Reporting Process

1. **Do not** create a public GitHub issue for security vulnerabilities
2. Email security reports to: [security-email-placeholder]
3. Include "Security Issue - Act CLI" in the subject line
4. Provide detailed information about the vulnerability

### Required Information

Please include the following in your security report:

- **Description**: Clear description of the vulnerability
- **Impact**: What an attacker could achieve
- **Steps**: How to reproduce the vulnerability
- **Affected Versions**: Which versions are affected
- **Suggested Fix**: If you have recommendations
- **Disclosure Timeline**: Your preferred disclosure timeline

### Response Process

1. **Acknowledgment**: We will acknowledge receipt within 48 hours
2. **Assessment**: We will assess the vulnerability within 5 business days
3. **Resolution**: We will work on a fix and coordinate disclosure
4. **Credit**: We will credit you in the security advisory (unless you prefer otherwise)

### Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 2**: Acknowledgment and initial assessment
- **Day 7**: Detailed assessment and fix planning
- **Day 30**: Target resolution (may vary based on complexity)
- **Day 90**: Maximum disclosure timeline (coordinated with reporter)

## Security Best Practices

### For Users

- Keep Act CLI updated to the latest version
- Review context content before sending to AI backends
- Use specific file paths rather than wildcards when possible
- Monitor file system usage and clear context regularly
- Avoid using `--exec` with untrusted command strings

### For Contributors

- Validate all user inputs
- Use parameterized queries/commands when possible
- Implement proper error handling to avoid information disclosure
- Follow secure coding practices
- Add security tests for new features

## Known Security Limitations

### Current Limitations

- AI backend communication is not encrypted by Act CLI (depends on backend implementation)
- Context data is stored unencrypted on local file system
- No built-in rate limiting for AI backend requests
- Command execution uses shell environment variables

### Planned Improvements

- Optional context encryption at rest
- Enhanced input validation
- Rate limiting configuration
- Security audit integration

## Threat Model

### Assumptions

- User has legitimate access to their development environment
- AI backends are trusted third-party services
- Local file system has appropriate user-level protections
- Network communication is handled by AI backend tools

### Threats Considered

- Command injection through `--exec` flag
- Path traversal attacks through file operations
- Resource exhaustion through large file processing
- Information disclosure through error messages
- Unauthorized access to context data

### Threats Not in Scope

- Network-level attacks on AI backend services
- Physical access to development machine
- Compromise of AI service provider infrastructure
- Operating system or runtime vulnerabilities

## Security Testing

### Automated Testing

Our test suite includes:

- Input validation tests
- Command injection prevention tests
- File system boundary tests
- Resource limit validation tests

### Manual Testing

Regular security testing includes:

- Penetration testing of input handling
- File system access validation
- Configuration tampering tests
- Error message information disclosure review

## Dependencies

### Security Updates

We monitor security advisories for all dependencies and:

- Update dependencies promptly for security fixes
- Use automated dependency scanning
- Review transitive dependencies for vulnerabilities
- Maintain minimal dependency footprint

### Trusted Dependencies

Core dependencies are limited to:

- Node.js standard library
- Well-established npm packages with good security records
- Packages with active maintenance and security response

## Compliance

### Standards Alignment

Act CLI security practices align with:

- OWASP Top 10 considerations
- Node.js Security Best Practices
- Common Weakness Enumeration (CWE) guidelines
- Secure Software Development Framework (SSDF)

### Regular Reviews

- Quarterly security review of codebase
- Annual threat model review
- Dependency security audit
- Documentation review for security implications

## Contact Information

For security-related questions or concerns:

- **Security Reports**: [security-email-placeholder]
- **General Security Questions**: Create a GitHub Discussion with "Security" tag
- **Documentation Issues**: Create a GitHub Issue with "security" label

## Acknowledgments

We thank the security research community for responsible disclosure and the following individuals who have contributed to Act CLI security:

- [Contributors will be listed here as they contribute]

---

This security policy is effective as of the document date and is subject to updates as the project evolves.