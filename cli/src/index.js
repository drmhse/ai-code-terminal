/**
 * Act CLI - AI-aware context management for terminal development
 * Main module exports
 */

const ContextManager = require('./context-manager');
const AIWrapper = require('./ai-wrapper');
const ConfigManager = require('./config-manager');

module.exports = {
  ContextManager,
  AIWrapper,
  ConfigManager
};