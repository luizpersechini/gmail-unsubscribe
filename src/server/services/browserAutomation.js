const path = require('path');
const puppeteer = require('puppeteer');
const config = require('../config');
const logger = require('../utils/logger');

class BrowserAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize(headless = true) {
    this.browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 },
    });

    this.page = await this.browser.newPage();
    await this.page.setDefaultTimeout(30_000);
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    );

    this.page.on('dialog', async (dialog) => {
      logger.info({ message: dialog.message() }, 'Dialog detected and accepted');
      await dialog.accept();
    });
  }

  async navigate(url) {
    try {
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
      await this._delay(2000);
      return true;
    } catch (error) {
      logger.error({ err: error, url }, 'Failed to navigate');
      return false;
    }
  }

  async click(selector, alternativeSelectors = []) {
    const selectors = [selector, ...(alternativeSelectors || [])].filter(Boolean);

    for (const sel of selectors) {
      try {
        await this.page.waitForSelector(sel, { timeout: 5000 });
        await this.page.click(sel);
        await this._delay(2000);
        return true;
      } catch {
        logger.debug({ selector: sel }, 'Selector not found, trying alternative');
      }
    }

    return this._clickByText();
  }

  async _clickByText() {
    try {
      const clicked = await this.page.evaluate(() => {
        const targets = Array.from(document.querySelectorAll('a, button')).map((el) => ({
          el,
          text: el.textContent?.trim().toLowerCase(),
        }));

        const match = targets.find(({ text }) => {
          if (!text) return false;
          return ['unsubscribe', 'opt out', 'remove me', 'confirm'].some((keyword) =>
            text.includes(keyword)
          );
        });

        if (!match) return false;
        match.el.click();
        return true;
      });

      if (clicked) {
        await this._delay(2000);
        return true;
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to click by text');
    }

    return false;
  }

  async fillField(selector, value) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');
      await this.page.type(selector, value, { delay: 80 });
      return true;
    } catch (error) {
      logger.debug({ err: error, selector }, 'Failed to fill field');
      return false;
    }
  }

  async fillForm(fields) {
    for (const field of fields) {
      const success =
        (field.selector && (await this.fillField(field.selector, field.value))) ||
        (await this._tryCommonSelectors(field.value));
      if (!success) return false;
    }
    return true;
  }

  async _tryCommonSelectors(value) {
    const selectors = ['input[type="email"]', '[placeholder*="email"]', '[name*="email"]'];
    for (const selector of selectors) {
      if (await this.fillField(selector, value)) {
        return true;
      }
    }
    return false;
  }

  async submitForm() {
    const buttons = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Submit")',
      'button:contains("Unsubscribe")',
      'button:contains("Confirm")',
    ];

    for (const selector of buttons) {
      try {
        await this.page.click(selector);
        await this._delay(3000);
        return true;
      } catch {
        // ignore
      }
    }

    try {
      await this.page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
      await this._delay(3000);
      return true;
    } catch (error) {
      logger.error({ err: error }, 'Failed to submit form');
      return false;
    }
  }

  async checkSuccess() {
    try {
      const text = await this.page.evaluate(() => document.body.innerText.toLowerCase());
      const keywords = [
        'successfully unsubscribed',
        'you have been unsubscribed',
        'unsubscribe successful',
        'preferences updated',
        'removed from our list',
        'no longer receive',
        'successfully removed',
        'unsubscription confirmed',
      ];
      return keywords.some((keyword) => text.includes(keyword));
    } catch (error) {
      logger.error({ err: error }, 'Failed to check success');
      return false;
    }
  }

  async getPageContent() {
    try {
      return await this.page.content();
    } catch (error) {
      logger.error({ err: error }, 'Failed to get page content');
      return '';
    }
  }

  getCurrentUrl() {
    try {
      return this.page.url();
    } catch (error) {
      logger.error({ err: error }, 'Failed to get current URL');
      return '';
    }
  }

  async screenshot(filename) {
    try {
      const filePath = path.join(config.storage.screenshotsDir, filename);
      await this.page.screenshot({ path: filePath, fullPage: true });
      return filePath;
    } catch (error) {
      logger.error({ err: error, filename }, 'Failed to take screenshot');
      return null;
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to close browser');
    } finally {
      this.browser = null;
      this.page = null;
    }
  }

  async _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = BrowserAutomation;
