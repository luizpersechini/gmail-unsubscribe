const config = require('../config');
const gmailService = require('../services/gmailService');

class StatusController {
  static async getAppStatus(_req, res, next) {
    try {
      const authorized = await gmailService.hasValidCredentials();

      res.json({
        authorized,
        env: config.env,
        server: config.server,
        time: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getConfig(_req, res, next) {
    try {
      const sanitized = {
        env: config.env,
        server: config.server,
        settings: config.settings,
        storage: config.storage,
        gmail: {
          redirectUri: config.gmail.redirectUri,
          hasClientId: Boolean(config.gmail.clientId),
          hasClientSecret: Boolean(config.gmail.clientSecret),
        },
        deepseek: {
          hasApiKey: Boolean(config.deepseek.apiKey),
          model: config.deepseek.defaultModel,
        },
      };

      res.json(sanitized);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = StatusController;
