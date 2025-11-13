const gmailService = require('./gmailService');
const config = require('../config');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.gmailScopes = ['https://www.googleapis.com/auth/gmail.modify'];
  }

  async listPromotionMessages({
    query = 'category:promotions',
    maxResults = config.settings.maxEmailsPerRun,
  } = {}) {
    const gmail = await gmailService.getGmailClient();

    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      return response.data.messages || [];
    } catch (error) {
      logger.error({ err: error }, 'Failed to list promotion messages');
      throw error;
    }
  }

  async fetchMessage(messageId) {
    const gmail = await gmailService.getGmailClient();

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return response.data;
  }

  async fetchPromotionEmails({ query, maxResults } = {}) {
    const ids = await this.listPromotionMessages({ query, maxResults });
    const emails = [];

    for (const { id } of ids) {
      try {
        const email = await this.fetchMessage(id);
        emails.push(email);
      } catch (error) {
        logger.warn({ err: error, id }, 'Failed to fetch message');
      }
    }

    return emails;
  }

  getBody(message) {
    if (!message.payload) {
      return '';
    }

    const { payload } = message;

    if (payload.parts && payload.parts.length > 0) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf8');
        }
      }

      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf8');
        }
      }
    }

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return '';
  }

  getHeader(message, name) {
    return (
      message.payload?.headers?.find(
        (header) => header.name.toLowerCase() === name.toLowerCase()
      )?.value || ''
    );
  }

  getSubject(message) {
    return this.getHeader(message, 'subject') || 'No Subject';
  }

  getSender(message) {
    return this.getHeader(message, 'from') || 'Unknown Sender';
  }

  async deleteMessage(messageId, permanent = false) {
    const gmail = await gmailService.getGmailClient();

    try {
      if (permanent) {
        await gmail.users.messages.delete({ userId: 'me', id: messageId });
        logger.info({ messageId }, 'Message permanently deleted');
      } else {
        await gmail.users.messages.trash({ userId: 'me', id: messageId });
        logger.info({ messageId }, 'Message moved to trash');
      }
      return true;
    } catch (error) {
      logger.error({ err: error, messageId }, 'Failed to delete message');
      return false;
    }
  }
}

module.exports = new EmailService();
