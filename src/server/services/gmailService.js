const { google } = require('googleapis');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class GmailService {
  constructor() {
    this.oauthClient = null;
    this.tokenPath = config.gmail.tokenPath;
    this.tokenLoaded = false;
  }

  _ensureClient() {
    if (this.oauthClient) {
      return this.oauthClient;
    }

    const { clientId, clientSecret, redirectUri } = config.gmail;
    if (!clientId || !clientSecret || !redirectUri) {
      const error = new Error('Gmail OAuth credentials missing');
      error.status = 422;
      throw error;
    }

    this.oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return this.oauthClient;
  }

  async _readToken() {
    try {
      const raw = await fs.readFile(this.tokenPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async _writeToken(token) {
    const dir = path.dirname(this.tokenPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2));
    this.tokenLoaded = true;
  }

  async _removeToken() {
    try {
      await fs.unlink(this.tokenPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    } finally {
      this.tokenLoaded = false;
      if (this.oauthClient) {
        this.oauthClient.setCredentials(null);
      }
    }
  }

  async loadCredentials() {
    let client;
    try {
      client = this._ensureClient();
    } catch (error) {
      if (error.status === 422) {
        return null;
      }
      throw error;
    }

    if (this.tokenLoaded && client.credentials) {
      return client;
    }

    const token = await this._readToken();
    if (!token) {
      return null;
    }

    client.setCredentials(token);
    this.tokenLoaded = true;

    if (await this._isExpired(token)) {
      try {
        const newToken = await client.getAccessToken();
        if (newToken && newToken.token) {
          await this._writeToken({ ...token, access_token: newToken.token });
        }
      } catch (error) {
        logger.warn({ err: error }, 'Failed to refresh access token, removing local token');
        await this._removeToken();
        return null;
      }
    }

    return this.oauthClient;
  }

  async _isExpired(token) {
    if (!token.expiry_date) {
      return false;
    }
    const bufferMs = 2 * 60 * 1000; // 2 minutes
    return Date.now() > token.expiry_date - bufferMs;
  }

  getAuthUrl() {
    const client = this._ensureClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.modify'],
    });
  }

  async exchangeCode(code) {
    const client = this._ensureClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    await this._writeToken(tokens);
    logger.info('Gmail tokens stored');
    return tokens;
  }

  async revokeToken() {
    const client = await this.loadCredentials();
    if (!client) {
      return false;
    }

    try {
      if (client.credentials && client.credentials.access_token) {
        await client.revokeToken(client.credentials.access_token);
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to revoke token with Google');
    } finally {
      await this._removeToken();
    }

    return true;
  }

  async hasValidCredentials() {
    const client = await this.loadCredentials();
    return Boolean(client);
  }

  async getGmailClient() {
    const client = await this.loadCredentials();
    if (!client) {
      const error = new Error('Gmail not authorized');
      error.status = 401;
      throw error;
    }

    return google.gmail({ version: 'v1', auth: client });
  }
}

module.exports = new GmailService();
