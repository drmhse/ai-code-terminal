# Contributing to Act CLI

We welcome contributions to Act CLI from the community. This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 14.0.0
- npm >= 6.0.0
- Git

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/act-cli.git
   cd act-cli
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Tests

Execute the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Code Style

This project follows standard JavaScript conventions:

- Use semicolons
- Use single quotes for strings
- Use 2-space indentation
- No trailing whitespace
- Maximum line length: 100 characters

Run the linter:
```bash
npm run lint
```

Fix auto-correctable issues:
```bash
npm run lint:fix
```

### Testing Guidelines

- Write unit tests for new functionality
- Maintain or improve test coverage
- Test error conditions and edge cases
- Use descriptive test names
- Follow the existing test patterns

### Documentation

- Update README.md for user-facing changes
- Update inline code comments for complex logic
- Add JSDoc comments for public APIs
- Update TROUBLESHOOTING.md for new error conditions

## Submission Process

### Pull Request Guidelines

1. **Title**: Use a clear, descriptive title
2. **Description**: Explain the problem and solution
3. **Testing**: Describe how the change was tested
4. **Documentation**: Reference any updated documentation
5. **Breaking Changes**: Clearly mark any breaking changes

### Pull Request Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] New tests added (if applicable)

## Documentation
- [ ] Documentation updated
- [ ] README updated (if applicable)
- [ ] Comments added to complex code

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] No console.log statements left
- [ ] Git history is clean
```

### Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(context): add file size validation
fix(config): resolve golden path loading issue
docs(readme): update installation instructions
```

## Issue Reporting

### Bug Reports

Include the following information:

1. **Version**: Act CLI version number
2. **Environment**: Operating system, Node.js version
3. **Steps**: Exact steps to reproduce
4. **Expected**: What you expected to happen
5. **Actual**: What actually happened
6. **Logs**: Any error messages or relevant output

### Feature Requests

Include the following information:

1. **Problem**: What problem does this solve?
2. **Solution**: Describe the proposed solution
3. **Alternatives**: Other solutions considered
4. **Impact**: Who would benefit from this change?

## Review Process

### Review Criteria

Pull requests are reviewed for:

- **Functionality**: Does it work as intended?
- **Code Quality**: Is the code well-structured and maintainable?
- **Testing**: Are there adequate tests?
- **Documentation**: Is the change properly documented?
- **Security**: Are there any security implications?
- **Performance**: Does it impact performance?

### Review Timeline

- Initial review: Within 48 hours
- Follow-up reviews: Within 24 hours
- Final approval: After all feedback addressed

## Security

### Reporting Security Issues

Do not create public GitHub issues for security vulnerabilities.

Instead, email security concerns to:
- **Email**: [security-email-placeholder]
- **Subject**: "Security Issue - Act CLI"
- **Content**: Detailed description of the vulnerability

### Security Guidelines

- Validate all user inputs
- Sanitize command execution parameters
- Handle file system operations securely
- Use secure defaults in configuration
- Document security considerations

## Development Guidelines

### Architecture Principles

- **Modularity**: Keep components focused and loosely coupled
- **Testability**: Write testable code with clear interfaces
- **Error Handling**: Provide clear, actionable error messages
- **Performance**: Consider resource usage and scalability
- **Security**: Validate inputs and handle privileges appropriately

### Code Organization

```
src/
├── context-manager.js    # Context buffer operations
├── config-manager.js     # Configuration management
├── ai-wrapper.js         # AI backend integration
└── index.js              # Main exports

bin/
└── act.js               # CLI entry point

__tests__/
├── context-manager.test.js
├── config-manager.test.js
├── ai-wrapper.test.js
└── integration.test.js
```

### Error Handling

- Use specific error types
- Provide helpful error messages
- Include diagnostic information
- Suggest resolution steps
- Log errors appropriately

### Performance Considerations

- Monitor memory usage
- Implement resource limits
- Use streams for large data
- Cache frequently accessed data
- Profile critical paths

## Release Process

### Version Numbering

This project follows Semantic Versioning (semver):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance benchmarks acceptable

## Community

### Communication Channels

- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and ideas
- **Documentation**: Project wiki for extended documentation

### Recognition

Contributors are recognized in:
- README.md contributor section
- Release notes acknowledgments
- Project documentation credits

## Legal

### Contributor License Agreement

By contributing to this project, you:

- Grant the project maintainers a perpetual, irrevocable license to your contributions
- Confirm you have the right to grant this license
- Understand that your contributions are public

### License Compatibility

All contributions must be compatible with the MIT License.

### Copyright

- New files: Include project copyright header
- Modified files: Maintain existing copyright notices
- Third-party code: Proper attribution required

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search existing issues
3. Create a new GitHub Discussion
4. Tag maintainers for urgent issues

Thank you for contributing to Act CLI!