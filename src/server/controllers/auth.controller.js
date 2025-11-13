const gmailService = require('../services/gmailService');
const logger = require('../utils/logger');

class AuthController {
  static async getAuthUrl(_req, res, next) {
    try {
      const url = gmailService.getAuthUrl();
      const authorized = await gmailService.hasValidCredentials();

      res.json({
        authorized,
        url,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exchangeCode(req, res, next) {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          error: 'InvalidRequest',
          message: 'Missing code in request body',
        });
      }

      const tokens = await gmailService.exchangeCode(code);

      res.status(201).json({
        authorized: true,
        tokens,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to exchange auth code');
      next(error);
    }
  }

  static async revokeToken(_req, res, next) {
    try {
      const revoked = await gmailService.revokeToken();
      res.json({
        revoked,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
