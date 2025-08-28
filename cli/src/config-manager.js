const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * Manages act-cli configuration
 * Handles reading/writing config file and shell integration
 */
class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.act');
    this.configPath = path.join(this.configDir, 'config.json');
    this.defaultConfig = {
      version: 1,
      ai_backend: {
        command: 'claude',
        args: ['--print']
      },
      prompt_template: {
        prefix: '### CONTEXT ###\n',
        item_header: '--- {type}: {source} ---\n',
        suffix: '\n### END CONTEXT ###\n\n### PROMPT ###\n'
      },
      golden_paths: {
        commit: `Write a conventional commit message for the following git diff.

Format: type(scope): description

IMPORTANT: Output ONLY the commit message. No explanations, no code blocks, no additional text.

Example output:
feat(auth): add user authentication system

Types: feat, fix, docs, style, refactor, test, chore
Keep first line under 50 characters.`,

        review: `Perform a comprehensive code review of the following changes.

Focus on:
1. **Bugs & Logic Issues**: Potential runtime errors, edge cases, null pointer issues
2. **Security**: Input validation, authentication, authorization concerns
3. **Performance**: Inefficient algorithms, memory leaks, unnecessary operations
4. **Code Quality**: Readability, maintainability, adherence to best practices
5. **Architecture**: Design patterns, separation of concerns, modularity

Structure your feedback by file with specific line references where applicable.
Prioritize critical issues first, then suggestions for improvement.`,

        test: `Based on the following code changes, generate comprehensive unit tests.

Requirements:
- Use Jest testing framework
- Cover all new functions and modified logic
- Include edge cases and error scenarios  
- Test both happy path and failure modes
- Use descriptive test names that explain what is being tested
- Include setup/teardown if needed for mocks or test data

Output only the complete test code in a single block, ready to run.`,

        explain: `Analyze and explain the following code/output in detail.

Please cover:
1. **What it does**: High-level purpose and functionality
2. **How it works**: Step-by-step breakdown of the logic
3. **Key concepts**: Important patterns, algorithms, or techniques used
4. **Context**: Why this approach was likely chosen
5. **Potential issues**: Any concerns or areas for improvement

Make the explanation clear for both beginners and experienced developers.`,

        fix: `Analyze the following error/issue and provide a solution.

Please provide:
1. **Root Cause**: What is causing this error/issue
2. **Impact**: How serious is this problem
3. **Solution**: Step-by-step fix with code examples if applicable
4. **Prevention**: How to avoid this issue in the future
5. **Testing**: How to verify the fix works

Focus on actionable solutions with clear implementation steps.`
      }
    };
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDir() {
    await fs.ensureDir(this.configDir);
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    await this.ensureConfigDir();
    
    if (!await fs.pathExists(this.configPath)) {
      await this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    }
    
    try {
      const config = await fs.readJson(this.configPath);
      // Merge with defaults to handle missing keys
      return { ...this.defaultConfig, ...config };
    } catch (error) {
      console.warn('Warning: Invalid config file, using defaults');
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config) {
    await this.ensureConfigDir();
    await fs.writeJson(this.configPath, config, { spaces: 2 });
  }

  /**
   * Get a configuration value by key path (e.g., 'ai_backend.command')
   */
  async get(keyPath) {
    const config = await this.loadConfig();
    const keys = keyPath.split('.');
    
    let value = config;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set a configuration value by key path
   */
  async set(keyPath, value) {
    const config = await this.loadConfig();
    const keys = keyPath.split('.');
    const lastKey = keys.pop();
    
    let target = config;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    // Try to parse as JSON if it looks like JSON (starts with [ or {)
    let parsedValue = value;
    if (typeof value === 'string' && (value.trim().startsWith('[') || value.trim().startsWith('{'))) {
      try {
        parsedValue = JSON.parse(value);
      } catch (error) {
        // If JSON parsing fails, use the original string value
        parsedValue = value;
      }
    }
    
    target[lastKey] = parsedValue;
    await this.saveConfig(config);
  }

  /**
   * Get all configuration
   */
  async getAll() {
    return await this.loadConfig();
  }

  /**
   * Get a golden path prompt
   */
  async getGoldenPath(name) {
    const config = await this.loadConfig();
    return config.golden_paths[name] || `Please help with ${name}`;
  }

  /**
   * Get AI backend configuration
   */
  async getAIBackend() {
    const config = await this.loadConfig();
    return config.ai_backend;
  }

  /**
   * Initialize act-cli (shell integration)
   */
  async init() {
    await this.ensureConfigDir();
    
    // Ensure config exists
    await this.loadConfig();
    
    const shell = process.env.SHELL || '/bin/bash';
    const shellName = path.basename(shell);
    
    let rcFile;
    switch (shellName) {
      case 'bash':
        rcFile = path.join(os.homedir(), '.bashrc');
        break;
      case 'zsh':
        rcFile = path.join(os.homedir(), '.zshrc');
        break;
      case 'fish':
        rcFile = path.join(os.homedir(), '.config', 'fish', 'config.fish');
        break;
      default:
        throw new Error(`Unsupported shell: ${shellName}. Please add act-cli to your PATH manually.`);
    }

    const actBinPath = path.join(this.configDir, 'bin', 'act');
    const integrationComment = '# ACT CLI Integration - Automatically added by \'act init\'';
    
    let shellFunction;
    if (shellName === 'fish') {
      shellFunction = `${integrationComment}
function act
    ${actBinPath} $argv
end`;
    } else {
      shellFunction = `${integrationComment}
act() {
  ${actBinPath} "$@"
}`;
    }

    // Check if already exists
    if (await fs.pathExists(rcFile)) {
      const content = await fs.readFile(rcFile, 'utf8');
      if (content.includes(integrationComment)) {
        console.log(`Shell integration already exists in ${rcFile}`);
        return;
      }
    }

    // Add to shell profile
    await fs.appendFile(rcFile, `\n${shellFunction}\n`);
    
    // Create symlink to the act binary in ~/.act/bin/
    const binDir = path.join(this.configDir, 'bin');
    await fs.ensureDir(binDir);
    
    const actualActPath = path.resolve(__dirname, '..', 'bin', 'act.js');
    const symlinkPath = path.join(binDir, 'act');
    
    try {
      await fs.remove(symlinkPath); // Remove existing symlink
      await fs.symlink(actualActPath, symlinkPath);
      await fs.chmod(symlinkPath, '755');
    } catch (error) {
      console.warn('Warning: Could not create symlink, you may need to add act-cli to PATH manually');
    }

    console.log(`Shell integration added to ${rcFile}`);
  }
}

module.exports = ConfigManager;