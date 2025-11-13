const config = require('../config');
const logger = require('../utils/logger');
const BrowserAutomation = require('./browserAutomation');
const deepseekService = require('./deepseekService');
const linkExtractor = require('./linkExtractor');
const emailService = require('./emailService');

const HEADLESS = config.env !== 'development';
const MAX_STEPS = 10;

class UnsubscribeService {
  async processMessage(message, options = {}, log = () => {}) {
    const subject = emailService.getSubject(message);
    const sender = emailService.getSender(message);
    const body = emailService.getBody(message);
    const messageId = message.id;
    const headless = options.headless ?? HEADLESS;

    const screenshots = [];
    const result = {
      messageId,
      subject,
      sender,
      success: false,
      methodTried: null,
      detail: '',
      screenshots,
      instructions: [],
    };

    const unsubscribeLinks = linkExtractor.findLinks(body);

    log('info', `Found ${unsubscribeLinks.length} unsubscribe link(s)`, { messageId });

    // Try direct link first if available
    if (unsubscribeLinks.length > 0) {
      const url = unsubscribeLinks[0];
      const attempt = await this._automatedUnsubscribe({
        url,
        screenshots,
        log,
        headless,
      });

      if (attempt.success) {
        result.success = true;
        result.methodTried = attempt.method;
        result.detail = attempt.detail;
        return result;
      }

      result.detail = attempt.detail;
      result.methodTried = attempt.method;
      log('warn', 'Direct unsubscribe link attempt did not confirm success', {
        messageId,
        detail: attempt.detail,
      });
    }

    // Use AI analysis if available
    try {
      const analysis = await deepseekService.analyzeEmail(body, sender);
      log('info', 'DeepSeek analysis completed', { analysis });

      result.instructions = analysis.instructions || [];
      result.methodTried = analysis.method || 'analysis';

      if (!analysis.hasUnsubscribeMethod) {
        result.detail = 'No unsubscribe instructions detected.';
        return result;
      }

      if (analysis.method === 'email') {
        result.detail = `Send unsubscribe request to ${analysis.emailToContact}`;
        return result;
      }

      const attempt = await this._automatedUnsubscribe({
        url: analysis.unsubscribeUrl,
        screenshots,
        log,
        headless,
      });

      result.success = attempt.success;
      result.detail = attempt.detail;
      result.methodTried = attempt.method;
      return result;
    } catch (error) {
      logger.warn({ err: error }, 'DeepSeek unavailable, returning manual instructions');
      if (!result.detail) {
        result.detail = 'AI analysis unavailable. Review email manually.';
      }
      return result;
    }
  }

  async _automatedUnsubscribe({ url, screenshots, log, headless }) {
    if (!url) {
      return {
        success: false,
        method: 'automation',
        detail: 'No unsubscribe URL provided',
      };
    }

    const automation = new BrowserAutomation();
    const timestamp = Date.now();
    try {
      await automation.initialize(headless);
      log('info', 'Browser launched for automation', { url });

      const navigated = await automation.navigate(url);
      if (!navigated) {
        return {
          success: false,
          method: 'automation',
          detail: 'Failed to open unsubscribe URL',
        };
      }

      const initialShot = await automation.screenshot(
        `unsubscribe_${timestamp}_initial.png`
      );
      if (initialShot) screenshots.push(initialShot);

      if (await automation.checkSuccess()) {
        const successShot = await automation.screenshot(
          `unsubscribe_${timestamp}_success.png`
        );
        if (successShot) screenshots.push(successShot);
        return {
          success: true,
          method: 'automation',
          detail: 'Success message detected after initial navigation',
        };
      }

      let previousAnalysis = null;

      for (let step = 1; step <= MAX_STEPS; step += 1) {
        const pageContent = await automation.getPageContent();
        const currentUrl = automation.getCurrentUrl();

        if (!config.deepseek.apiKey) {
          return {
            success: false,
            method: 'automation',
            detail:
              'DeepSeek API key missing. Provide key to automate complex unsubscribe flows.',
          };
        }

        const analysis = await deepseekService.nextStep(
          pageContent,
          currentUrl,
          previousAnalysis
        );
        previousAnalysis = analysis;

        log('info', `Automation step ${step}`, { analysis });

        if (analysis.action === 'complete') {
          const successShot = await automation.screenshot(
            `unsubscribe_${timestamp}_complete.png`
          );
          if (successShot) screenshots.push(successShot);
          return {
            success: true,
            method: 'automation',
            detail: analysis.message || 'Unsubscribe completed',
          };
        }

        if (analysis.action === 'failed') {
          return {
            success: false,
            method: 'automation',
            detail: analysis.message || 'Automation failed',
          };
        }

        await this._executeStep(automation, analysis);

        if (step % 2 === 0) {
          const stepShot = await automation.screenshot(
            `unsubscribe_${timestamp}_step${step}.png`
          );
          if (stepShot) screenshots.push(stepShot);
        }

        if (await automation.checkSuccess()) {
          const successShot = await automation.screenshot(
            `unsubscribe_${timestamp}_success.png`
          );
          if (successShot) screenshots.push(successShot);
          return {
            success: true,
            method: 'automation',
            detail: 'Success message detected after automation steps',
          };
        }
      }

      return {
        success: false,
        method: 'automation',
        detail: 'Max automation steps reached without confirmation',
      };
    } catch (error) {
      logger.error({ err: error }, 'Automation error');
      return {
        success: false,
        method: 'automation',
        detail: error.message || 'Automation failed with unexpected error',
      };
    } finally {
      await automation.close();
    }
  }

  async _executeStep(automation, analysis) {
    switch (analysis.action) {
      case 'click':
        return automation.click(analysis.target?.selector, analysis.target?.alternativeSelectors);
      case 'fill_form':
        if (await automation.fillForm(analysis.formData || [])) {
          return automation.submitForm();
        }
        return false;
      case 'navigate':
        return automation.navigate(analysis.navigateUrl);
      default:
        return false;
    }
  }
}

module.exports = new UnsubscribeService();
