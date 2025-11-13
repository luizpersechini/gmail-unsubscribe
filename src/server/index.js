const http = require('http');
const config = require('./config');
const logger = require('./utils/logger');
const app = require('./app');

const server = http.createServer(app);
let currentPort = config.server.port;
let retried = false;

const start = () => {
  const listen = (port) => {
    currentPort = port;
    server.listen(port, config.server.host, () => {
      const address = server.address();
      const actualPort = address && typeof address === 'object' ? address.port : port;
      logger.info(
        `Server listening on http://${config.server.host}:${actualPort} in ${config.env} mode`
      );
    });
  };

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && !retried) {
      retried = true;
      logger.warn(
        `Port ${currentPort} is in use. Retrying on a random available port...`
      );
      setTimeout(() => listen(0), 100);
      return;
    }

    logger.error({ err: error }, 'Server error');
    process.exit(1);
  });

  listen(currentPort);
};

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start,
  server,
};
