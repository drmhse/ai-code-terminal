# Changelog

All notable changes to Act CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2024-01-XX

### Added
- Comprehensive test suite with Jest
- Input validation for command execution
- File size limits for context buffer
- Professional documentation set (README, TROUBLESHOOTING, CONTRIBUTING, SECURITY)
- Technical requirements and design specifications
- Changelog and proper versioning

### Changed
- Improved error handling and user feedback
- Enhanced security through input sanitization
- Removed emojis from CLI output for professional appearance
- Standardized documentation format following Linux Foundation patterns
- Updated package metadata and descriptions

### Fixed
- Configuration loading issues in golden path commands
- Test failures in context manager and AI wrapper
- Jest worker spawn errors on certain systems
- ID generation persistence across context manager instances

### Security
- Added command injection prevention
- Implemented file size validation (5MB limit)
- Enhanced input sanitization for --exec flag
- Comprehensive security policy documentation

## [0.1.1] - 2024-01-XX

### Fixed
- Initial bug fixes and stability improvements
- Test suite implementation and fixes

## [0.1.0] - 2024-01-XX

### Added
- Initial release of Act CLI
- Context buffer management
- AI backend integration
- Git diff and file context support
- Command output capture
- Golden path workflows (commit, review, test)
- Configuration management
- Shell integration

### Features
- `act context add` command for files and diffs
- `act do` command for AI interaction
- `act commit` for AI-generated commit messages
- `act review` for code review workflows
- `act config` for configuration management
- Cross-platform support (Linux, macOS)

[Unreleased]: https://github.com/organization/act-cli/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/organization/act-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/organization/act-cli/releases/tag/v0.1.0