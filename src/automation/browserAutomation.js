const puppeteer = require('puppeteer');

class BrowserAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the browser
   * @param {Boolean} headless - Whether to run in headless mode
   */
  async initialize(headless = false) {
    this.browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });
    
    this.page = await this.browser.newPage();
    
    // Set a reasonable timeout
    await this.page.setDefaultTimeout(30000);
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  /**
   * Navigate to a URL
   * @param {String} url - URL to navigate to
   */
  async navigate(url) {
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait a bit for any JavaScript to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } catch (error) {
      console.error(`Failed to navigate to ${url}:`, error.message);
      return false;
    }
  }

  /**
   * Click an element
   * @param {String} selector - CSS selector
   * @param {Array} alternativeSelectors - Alternative selectors to try
   */
  async click(selector, alternativeSelectors = []) {
    const selectors = [selector, ...alternativeSelectors];
    
    for (const sel of selectors) {
      try {
        await this.page.waitForSelector(sel, { timeout: 5000 });
        await this.page.click(sel);
        
        // Wait for navigation or changes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return true;
      } catch (error) {
        console.log(`Selector ${sel} not found, trying alternatives...`);
      }
    }
    
    // Try clicking by text content
    try {
      const elements = await this.page.$$eval('a, button', (elements, selector) => {
        return elements.map(el => ({
          index: elements.indexOf(el),
          text: el.textContent.trim(),
          href: el.href
        }));
      });
      
      const targetElement = elements.find(el => 
        el.text.toLowerCase().includes('unsubscribe') ||
        el.text.toLowerCase().includes('opt out') ||
        el.text.toLowerCase().includes('remove me')
      );
      
      if (targetElement) {
        await this.page.evaluate((index) => {
          document.querySelectorAll('a, button')[index].click();
        }, targetElement.index);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
    } catch (error) {
      console.error('Failed to click by text:', error.message);
    }
    
    return false;
  }

  /**
   * Fill a form field
   * @param {String} selector - Input selector
   * @param {String} value - Value to enter
   */
  async fillField(selector, value) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      
      // Clear existing value
      await this.page.click(selector, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');
      
      // Type new value
      await this.page.type(selector, value, { delay: 100 });
      
      return true;
    } catch (error) {
      console.error(`Failed to fill field ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Fill multiple form fields
   * @param {Array} fields - Array of {selector, value} objects
   */
  async fillForm(fields) {
    let success = true;
    
    for (const field of fields) {
      const filled = await this.fillField(field.selector, field.value);
      if (!filled) {
        // Try common input selectors
        const alternativeSelectors = [
          `input[name="${field.selector}"]`,
          `input[type="email"]`,
          `input[placeholder*="email"]`,
          `#${field.selector}`,
          `.${field.selector}`
        ];
        
        let filled = false;
        for (const altSelector of alternativeSelectors) {
          if (await this.fillField(altSelector, field.value)) {
            filled = true;
            break;
          }
        }
        
        if (!filled) {
          success = false;
        }
      }
    }
    
    return success;
  }

  /**
   * Submit a form
   * @param {String} formSelector - Form selector
   */
  async submitForm(formSelector = 'form') {
    try {
      // Try to find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Submit")',
        'button:contains("Unsubscribe")',
        'button:contains("Confirm")',
        'a:contains("Unsubscribe")',
        'a:contains("Confirm")'
      ];
      
      for (const selector of submitSelectors) {
        try {
          await this.page.click(selector);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return true;
        } catch (e) {
          // Try next selector
        }
      }
      
      // If no submit button found, try submitting the form directly
      await this.page.evaluate((selector) => {
        const form = document.querySelector(selector);
        if (form) form.submit();
      }, formSelector);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      return true;
    } catch (error) {
      console.error('Failed to submit form:', error.message);
      return false;
    }
  }

  /**
   * Check if unsubscribe was successful
   * @returns {Boolean}
   */
  async checkSuccess() {
    try {
      const pageContent = await this.page.content();
      const pageText = await this.page.evaluate(() => document.body.innerText);
      
      const successKeywords = [
        'successfully unsubscribed',
        'you have been unsubscribed',
        'unsubscribe successful',
        'removed from our list',
        'no longer receive',
        'opt-out successful',
        'preferences updated',
        'successfully removed',
        'unsubscription confirmed'
      ];
      
      const textLower = pageText.toLowerCase();
      return successKeywords.some(keyword => textLower.includes(keyword));
    } catch (error) {
      console.error('Error checking success:', error.message);
      return false;
    }
  }

  /**
   * Get current page content
   * @returns {String} HTML content
   */
  async getPageContent() {
    try {
      return await this.page.content();
    } catch (error) {
      console.error('Error getting page content:', error.message);
      return '';
    }
  }

  /**
   * Get current page URL
   * @returns {String} Current URL
   */
  getCurrentUrl() {
    try {
      return this.page.url();
    } catch (error) {
      console.error('Error getting current URL:', error.message);
      return '';
    }
  }

  /**
   * Take a screenshot for debugging
   * @param {String} filename - Screenshot filename
   */
  async takeScreenshot(filename) {
    try {
      await this.page.screenshot({ 
        path: `screenshots/${filename}`,
        fullPage: true 
      });
      console.log(`Screenshot saved: ${filename}`);
    } catch (error) {
      console.error('Error taking screenshot:', error.message);
    }
  }

  /**
   * Handle popups and alerts
   */
  async handlePopups() {
    this.page.on('dialog', async dialog => {
      console.log(`Dialog appeared: ${dialog.message()}`);
      await dialog.accept();
    });
  }

  /**
   * Close the browser
   */
  async close() {
    try {
      if (this.browser && this.browser.isConnected()) {
        await this.browser.close();
      }
    } catch (error) {
      console.log('Browser already closed or disconnected');
    } finally {
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = BrowserAutomation;
