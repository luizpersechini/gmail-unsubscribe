const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');

class DeepSeekService {
  constructor() {
    this.apiKey = config.deepseek.apiKey;
    this.baseURL = 'https://api.deepseek.com/v1';
    this.model = config.deepseek.defaultModel || 'deepseek-chat';
  }

  ensureCredentials() {
    if (!this.apiKey) {
      const error = new Error('DeepSeek API key missing');
      error.status = 422;
      throw error;
    }
  }

  async analyzeEmail(emailContent, sender) {
    this.ensureCredentials();
    const prompt = `You are an expert at analyzing emails to find unsubscribe methods.

From: ${sender}
Email Content:
${this._cleanEmailContent(emailContent)}

Return JSON:
{
  "hasUnsubscribeMethod": true/false,
  "method": "link" | "form" | "email" | "complex" | "none",
  "unsubscribeUrl": "URL if found",
  "instructions": ["step by step instructions"],
  "formFields": [{"selector": "...", "value": "..."}],
  "emailToContact": "address if method is email",
  "confidence": 0-100
}`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing emails and finding unsubscribe methods. Respond with strict JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20_000,
        }
      );

      return this._parseJson(response.data.choices[0].message.content);
    } catch (error) {
      logger.error({ err: error }, 'DeepSeek analyzeEmail failed');
      throw error;
    }
  }

  async nextStep(pageContent, currentUrl, previousAnalysis = null) {
    this.ensureCredentials();
    const prompt = `You are guiding an automated browser through an unsubscribe process.

Current URL: ${currentUrl}
${previousAnalysis ? `Previous Analysis: ${JSON.stringify(previousAnalysis)}` : ''}

Important Elements:
${this._summarizeHtml(pageContent)}

Return JSON:
{
  "action": "click" | "fill_form" | "select" | "navigate" | "complete" | "failed",
  "target": {
    "selector": "CSS selector or XPath",
    "alternativeSelectors": ["..."],
    "text": "visible label"
  },
  "formData": [{"selector": "input selector", "value": "value"}],
  "navigateUrl": "URL to visit",
  "message": "human explanation",
  "confidence": 0-100
}`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at web automation. Respond with strict JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20_000,
        }
      );

      return this._parseJson(response.data.choices[0].message.content);
    } catch (error) {
      logger.error({ err: error }, 'DeepSeek nextStep failed');
      throw error;
    }
  }

  _parseJson(content) {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error('Failed to parse DeepSeek response');
    }
  }

  _cleanEmailContent(content) {
    return content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  }

  _summarizeHtml(html) {
    const cleaned = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    const $ = cheerio.load(cleaned);
    const elements = [];

    $('form, button, a, input, select, textarea, [onclick]').each((_, elem) => {
      const $elem = $(elem);
      elements.push({
        tag: elem.tagName,
        text: $elem.text().trim().slice(0, 80),
        href: $elem.attr('href') || null,
        action: $elem.attr('action') || null,
        onclick: $elem.attr('onclick') || null,
        type: $elem.attr('type') || null,
        name: $elem.attr('name') || null,
        id: $elem.attr('id') || null,
        class: $elem.attr('class') || null,
      });
    });

    const bodyText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);

    return JSON.stringify(
      {
        elements: elements.slice(0, 60),
        bodyText,
      },
      null,
      2
    );
  }
}

module.exports = new DeepSeekService();
