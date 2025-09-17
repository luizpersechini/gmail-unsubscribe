#!/usr/bin/env node

/**
 * Background Agent: Process Emails
 * Automatically processes promotional emails and unsubscribes
 */

const path = require('path');
const fs = require('fs');

// Set environment variables for background processing
process.env.AUTO_CONTINUE = 'true';
process.env.DELETE_AFTER_UNSUBSCRIBE = process.env.DELETE_AFTER_UNSUBSCRIBE || 'true';

// Logging setup
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `process-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Override console.log to also write to file
const originalLog = console.log;
console.log = function(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(' ')}`;
  originalLog(message);
  logStream.write(message + '\n');
};

console.log('🤖 Background Agent: Email Processing Started');
console.log(`📁 Logs will be saved to: ${logFile}`);

// Import main application
const main = require('../../src/main');

// Run with error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  logStream.end();
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  logStream.end();
  process.exit(1);
});

// Execute main process
console.log('🚀 Starting email processing...');
console.log('⚙️  Configuration:');
console.log(`   - Auto Continue: ${process.env.AUTO_CONTINUE}`);
console.log(`   - Delete After Unsubscribe: ${process.env.DELETE_AFTER_UNSUBSCRIBE}`);
console.log(`   - Max Emails: ${process.env.MAX_EMAILS_TO_PROCESS || '10'}`);

// Ensure process exits cleanly
process.on('exit', () => {
  console.log('🏁 Background Agent: Email Processing Completed');
  logStream.end();
});
