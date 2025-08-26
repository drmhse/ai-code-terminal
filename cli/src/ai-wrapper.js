const { spawn } = require('child_process');
const ConfigManager = require('./config-manager');

/**
 * Wraps AI CLI commands with context injection
 * Manages communication with configured AI backends
 */
class AIWrapper {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Query the AI with context and prompt
   */
  async query(prompt, contextItems = []) {
    const backend = await this.configManager.getAIBackend();
    const formattedPrompt = this.formatPrompt(prompt, contextItems);
    
    return new Promise((resolve, reject) => {
      // Spawn the AI CLI process
      const aiProcess = spawn(backend.command, backend.args, {
        stdio: ['pipe', 'inherit', 'inherit']
      });

      // Handle process errors
      aiProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error(`AI backend '${backend.command}' not found. Please ensure it's installed and in PATH.`));
        } else {
          reject(error);
        }
      });

      // Handle process exit
      aiProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`AI backend exited with code ${code}`));
        }
      });

      // Send the formatted prompt to the AI
      aiProcess.stdin.write(formattedPrompt);
      aiProcess.stdin.end();
    });
  }

  /**
   * Format prompt with context
   */
  formatPrompt(prompt, contextItems) {
    if (contextItems.length === 0) {
      return prompt;
    }

    let formatted = '### CONTEXT ###\n';
    
    for (const item of contextItems) {
      formatted += `--- ${item.metadata.type}: ${item.metadata.source} ---\n`;
      formatted += `${item.content}\n\n`;
    }
    
    formatted += '### END CONTEXT ###\n\n';
    formatted += '### PROMPT ###\n';
    formatted += prompt;
    
    return formatted;
  }

  /**
   * Check if AI backend is available
   */
  async checkBackend() {
    const backend = await this.configManager.getAIBackend();
    
    return new Promise((resolve) => {
      const testProcess = spawn(backend.command, ['--version'], {
        stdio: 'pipe'
      });

      testProcess.on('error', () => resolve(false));
      testProcess.on('close', (code) => resolve(code === 0));
    });
  }

  /**
   * Get available AI backends
   */
  getAvailableBackends() {
    return [
      'claude',
      'openai',
      'gemini',
      'ollama'
    ];
  }
}

module.exports = AIWrapper;