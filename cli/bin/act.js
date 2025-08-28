#!/usr/bin/env node

/**
 * Act CLI - AI-aware context management for terminal development
 * Entry point for the act command line interface
 */

const { program } = require('commander');
const { version, description } = require('../package.json');
const ContextManager = require('../src/context-manager');
const AIWrapper = require('../src/ai-wrapper');
const ConfigManager = require('../src/config-manager');

// Initialize managers
const contextManager = new ContextManager();
const aiWrapper = new AIWrapper();
const configManager = new ConfigManager();

// Configure the CLI
program
  .name('act')
  .description(description)
  .version(version);

// Context management commands
const contextCmd = program
  .command('context')
  .alias('c')
  .description('Manage AI context buffer');

contextCmd
  .command('add [paths...]')
  .alias('a')
  .description('Add files or directories to the context buffer')
  .option('-d, --diff', 'Add staged git diff to context')
  .option('-x, --exec <command>', 'Execute command and add output to context')
  .action(async (paths, options) => {
    try {
      if (options.diff) {
        await contextManager.addGitDiff();
        console.log('Added staged git diff to context');
      } else if (options.exec) {
        await contextManager.addCommandOutput(options.exec);
        console.log(`Added output of '${options.exec}' to context`);
      } else if (paths && paths.length > 0) {
        for (const path of paths) {
          await contextManager.addFile(path);
          console.log(`Added ${path} to context`);
        }
      } else {
        console.error('Please specify files to add, use --diff for git diff, or --exec for command output');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error adding to context:', error.message);
      process.exit(1);
    }
  });

contextCmd
  .command('list')
  .alias('ls')
  .description('List items in the context buffer')
  .action(async () => {
    try {
      const items = await contextManager.list();
      if (items.length === 0) {
        console.log('Context buffer is empty');
        return;
      }
      
      console.log('Context buffer contents:');
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. [${item.metadata.type}] ${item.metadata.source} (${item.metadata.size} bytes)`);
      });
    } catch (error) {
      console.error('Error listing context:', error.message);
      process.exit(1);
    }
  });

contextCmd
  .command('show [index]')
  .alias('cat')
  .description('Show content of a specific context item')
  .action(async (index) => {
    try {
      if (index) {
        const item = await contextManager.get(parseInt(index) - 1);
        if (!item) {
          console.error(`No context item at index ${index}`);
          process.exit(1);
        }
        console.log(`--- ${item.metadata.type}: ${item.metadata.source} ---`);
        console.log(item.content);
      } else {
        // Show all context
        const items = await contextManager.list();
        if (items.length === 0) {
          console.log('Context buffer is empty');
          return;
        }
        
        items.forEach((item, index) => {
          console.log(`--- ${index + 1}. ${item.metadata.type}: ${item.metadata.source} ---`);
          console.log(item.content);
          console.log('');
        });
      }
    } catch (error) {
      console.error('Error showing context:', error.message);
      process.exit(1);
    }
  });

contextCmd
  .command('remove <items...>')
  .alias('rm')
  .description('Remove items from the context buffer by index or filename pattern')
  .action(async (items) => {
    try {
      const removedCount = await contextManager.removeItems(items);
      console.log(`Removed ${removedCount} item(s) from context`);
    } catch (error) {
      console.error('Error removing from context:', error.message);
      process.exit(1);
    }
  });

contextCmd
  .command('clear')
  .description('Clear the entire context buffer')
  .action(async () => {
    try {
      await contextManager.clear();
      console.log('Context buffer cleared');
    } catch (error) {
      console.error('Error clearing context:', error.message);
      process.exit(1);
    }
  });

// AI interaction commands
program
  .command('do <prompt>')
  .description('Send prompt with context to AI')
  .option('--no-context', 'Send prompt without context buffer')
  .option('--dry-run', 'Show what would be sent to AI without actually sending')
  .action(async (prompt, options) => {
    try {
      if (options.dryRun) {
        const contextItems = options.noContext ? [] : await contextManager.list();
        const formattedPrompt = await aiWrapper.formatPrompt(prompt, contextItems);
        console.log('=== DRY RUN: Would send to AI ===');
        console.log(formattedPrompt);
        console.log('=== END DRY RUN ===');
        return;
      }
      
      if (options.noContext) {
        await aiWrapper.query(prompt, []);
      } else {
        const contextItems = await contextManager.list();
        await aiWrapper.query(prompt, contextItems);
      }
    } catch (error) {
      console.error('Error querying AI:', error.message);
      process.exit(1);
    }
  });

// Utility command for piping output
program
  .command('pipe')
  .description('Read from stdin and add to context (useful for piping command output)')
  .option('-t, --type <type>', 'Context type', 'exec')
  .option('-s, --source <source>', 'Context source description', 'piped input')
  .action(async (options) => {
    try {
      let input = '';
      
      // Read from stdin
      process.stdin.setEncoding('utf8');
      
      for await (const chunk of process.stdin) {
        input += chunk;
      }
      
      if (!input.trim()) {
        console.error('No input received from pipe');
        process.exit(1);
      }
      
      const id = await contextManager.getNextId();
      const contextItem = {
        metadata: {
          type: options.type,
          source: options.source,
          timestamp: new Date().toISOString(),
          size: Buffer.byteLength(input, 'utf8')
        },
        content: input.trim()
      };
      
      const path = require('path');
      const fs = require('fs-extra');
      
      await contextManager.ensureContextDir();
      const filename = `${id}_${options.type}.json`;
      const filePath = path.join(contextManager.contextDir, filename);
      await fs.writeFile(filePath, JSON.stringify(contextItem, null, 2));
      
      console.log(`Added piped input to context (${contextItem.metadata.size} bytes)`);
    } catch (error) {
      console.error('Error adding piped input:', error.message);
      process.exit(1);
    }
  });

// Golden path commands
program
  .command('commit')
  .description('Generate commit message from staged changes')
  .option('-a, --all', 'Stage all modified files before generating commit message')
  .action(async (options) => {
    try {
      if (options.all) {
        const { execSync } = require('child_process');
        execSync('git add -A');
        console.log('Staged all changes');
      }
      
      await contextManager.clear();
      await contextManager.addGitDiff();
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error('No staged changes found. Run `git add` first or use --all flag.');
        process.exit(1);
      }
      
      const prompt = await configManager.getGoldenPath('commit');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error generating commit message:', error.message);
      process.exit(1);
    }
  });

program
  .command('review')
  .description('Review changes on current branch against main')
  .option('-b, --base <branch>', 'Base branch to compare against', 'main')
  .action(async (options) => {
    try {
      await contextManager.clear();
      await contextManager.addGitDiff(options.base);
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error(`No changes found to review against ${options.base}`);
        process.exit(1);
      }
      
      const prompt = await configManager.getGoldenPath('review');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error reviewing code:', error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Generate tests for staged changes')
  .option('-a, --all', 'Stage all modified files before generating tests')
  .action(async (options) => {
    try {
      if (options.all) {
        const { execSync } = require('child_process');
        execSync('git add -A');
        console.log('Staged all changes');
      }
      
      await contextManager.clear();
      await contextManager.addGitDiff();
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error('No staged changes found. Run `git add` first or use --all flag.');
        process.exit(1);
      }
      
      const prompt = await configManager.getGoldenPath('test');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error generating tests:', error.message);
      process.exit(1);
    }
  });

program
  .command('explain')
  .description('Explain code or command output with auto-context')
  .option('-c, --clear', 'Clear context before explaining')
  .action(async (options) => {
    try {
      if (options.clear) {
        await contextManager.clear();
        console.log('Context cleared');
      }
      
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error('No context found. Add files, diffs, or command output first:');
        console.error('  act context add <file>');
        console.error('  act context add --diff');
        console.error('  act context add --exec "<command>"');
        process.exit(1);
      }
      
      const prompt = await configManager.getGoldenPath('explain');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error explaining context:', error.message);
      process.exit(1);
    }
  });

program
  .command('fix')
  .description('Analyze errors and provide AI-powered fixes')
  .option('-c, --clear', 'Clear context before analyzing')
  .action(async (options) => {
    try {
      if (options.clear) {
        await contextManager.clear();
        console.log('Context cleared');
      }
      
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error('No context found. Add error output or problematic code first:');
        console.error('  act context add --exec "npm test"  # Add failing test output');
        console.error('  act context add error.log          # Add error logs');
        console.error('  act context add problematic.js     # Add problematic code');
        process.exit(1);
      }
      
      const prompt = await configManager.getGoldenPath('fix');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error analyzing for fixes:', error.message);
      process.exit(1);
    }
  });

// Configuration commands
const configCmd = program
  .command('config')
  .description('Manage act-cli configuration');

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key, value) => {
    try {
      await configManager.set(key, value);
      console.log(`Configuration ${key} set to ${value}`);
    } catch (error) {
      console.error('Error setting configuration:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key) => {
    try {
      const value = await configManager.get(key);
      if (value !== undefined) {
        console.log(value);
      } else {
        console.error(`Configuration key '${key}' not found`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error getting configuration:', error.message);
      process.exit(1);
    }
  });

configCmd
  .command('list')
  .description('Show all configuration values')
  .action(async () => {
    try {
      const config = await configManager.getAll();
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error listing configuration:', error.message);
      process.exit(1);
    }
  });

// Initialize command
program
  .command('init')
  .description('Initialize act-cli for the current user')
  .action(async () => {
    try {
      await configManager.init();
      console.log('act-cli initialized successfully');
      console.log('You may need to restart your shell or run `source ~/.bashrc` (or ~/.zshrc)');
    } catch (error) {
      console.error('Error initializing act-cli:', error.message);
      process.exit(1);
    }
  });

// Workflow shortcuts and aliases
program
  .command('quick-commit')
  .alias('qc')
  .description('Stage all changes and generate commit message in one step')
  .action(async () => {
    try {
      const { execSync } = require('child_process');
      execSync('git add -A');
      console.log('Staged all changes');
      
      await contextManager.clear();
      await contextManager.addGitDiff();
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error('No changes to commit');
        process.exit(1);
      }
      
      console.log('Generating commit message...');
      const prompt = await configManager.getGoldenPath('commit');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error with quick commit:', error.message);
      process.exit(1);
    }
  });

program
  .command('debug')
  .description('Capture error output and get AI-powered debugging help')
  .argument('<command>', 'Command to run and debug')
  .action(async (command) => {
    try {
      console.log(`Running: ${command}`);
      await contextManager.clear();
      
      // Try to run the command and capture output (including errors)
      try {
        await contextManager.addCommandOutput(command);
      } catch (execError) {
        // Command failed, but that's what we want to debug
        console.log('Command failed (as expected for debugging)');
      }
      
      const contextItems = await contextManager.list();
      
      if (contextItems.length === 0) {
        console.error('No output captured from command');
        process.exit(1);
      }
      
      console.log('Analyzing error output...');
      const prompt = await configManager.getGoldenPath('fix');
      await aiWrapper.query(prompt, contextItems);
    } catch (error) {
      console.error('Error debugging command:', error.message);
      process.exit(1);
    }
  });

program
  .command('workflow')
  .description('Show common act-cli workflows and examples')
  .action(() => {
    console.log(`
Act CLI Workflows

COMMIT WORKFLOW:
  git add .                    # Stage changes  
  act commit                   # Generate commit message
  act quick-commit             # Stage all + generate commit (shortcut)

CODE REVIEW:
  act review                   # Review current branch vs main
  act review -b develop        # Review vs different base branch

TESTING WORKFLOW:
  act test                     # Generate tests for staged changes
  act test -a                  # Stage all + generate tests

DEBUGGING WORKFLOW:
  act debug "npm test"         # Run failing command + get AI help
  npm test 2>&1 | act pipe     # Pipe error output + explain
  act context add error.log    # Add error file + fix

EXPLANATION WORKFLOW:
  act context add complex.js   # Add complex code
  act explain                  # Get detailed explanation
  
GENERAL PATTERNS:
  act context add file.js      # Add files to context
  act context add --diff       # Add git diff  
  act context add --exec "cmd" # Add command output
  command | act pipe           # Pipe any output to context
  act do "custom prompt"       # Query with context
  act do --dry-run "prompt"    # Preview what gets sent
`);
  });

// Parse command line arguments
program.parse();