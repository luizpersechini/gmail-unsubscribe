const pino = require('pino');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const logFile = path.join(config.storage.logsDir, 'server.log');

if (!fs.existsSync(config.storage.logsDir)) {
  fs.mkdirSync(config.storage.logsDir, { recursive: true });
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  }, pino.destination({ dest: logFile, sync: true }));

module.exports = logger;
