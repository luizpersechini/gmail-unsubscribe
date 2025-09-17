const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('../../config/config');
const DeepSeekClient = require('../ai/deepseekClient');
const BrowserAutomation = require('../automation/browserAutomation');

/**
 * Find unsubscribe links in an email
 * @param {String} emailBody - HTML content of the email
 * @returns {Array} - List of potential unsubscribe URLs
 */
function findUnsubscribeLinks(emailBody) {
  if (!emailBody) {
    return [];
  }
  
  const $ = cheerio.load(emailBody);
  const unsubscribeLinks = [];
  
  // Look for links with common unsubscribe keywords
  const unsubscribeKeywords = [
    'unsubscribe', 'opt-out', 'opt out', 'remove me', 
    'stop receiving', 'cancel subscription', 'manage preferences'
  ];
  
  $('a').each((i, link) => {
    const linkText = $(link).text().toLowerCase();
    const linkHref = $(link).attr('href');
    
    if (!linkHref) return;
    
    // Check if link text contains unsubscribe keywords
    const hasUnsubscribeKeyword = unsubscribeKeywords.some(keyword => 
      linkText.includes(keyword)
    );
    
    if (hasUnsubscribeKeyword && linkHref.startsWith('http')) {
      unsubscribeLinks.push(linkHref);
    }
  });
  
  // Look for List-Unsubscribe header link
  const listUnsubscribeLink = $('meta[name="List-Unsubscribe"]').attr('content');
  if (listUnsubscribeLink) {
    // Extract URLs from angle brackets if present
    const matches = listUnsubscribeLink.match(/<(https?:\/\/[^>]+)>/g);
    if (matches) {
      matches.forEach(match => {
        const url = match.substring(1, match.length - 1);
        if (url.startsWith('http')) {
          unsubscribeLinks.push(url);
        }
      });
    } else if (listUnsubscribeLink.startsWith('http')) {
      unsubscribeLinks.push(listUnsubscribeLink);
    }
  }
  
  return [...new Set(unsubscribeLinks)]; // Remove duplicates
}

/**
 * Open a URL in the default browser
 * @param {String} url - URL to open
 * @returns {Promise<Boolean>} - Success status
 */
function openInBrowser(url) {
  return new Promise((resolve) => {
    let command;
    
    // Determine the command based on the platform
    switch (process.platform) {
      case 'darwin': // macOS
        command = `open "${url}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${url}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${url}"`;
    }
    
    // Execute the command
    exec(command, (error) => {
      if (error) {
        console.error(`Error opening URL: ${error.message}`);
        resolve(false);
      } else {
        console.log(`Opened in browser: ${url}`);
        resolve(true);
      }
    });
  });
}

/**
 * Process an unsubscribe link by opening it in the default browser
 * @param {String} url - Unsubscribe URL
 * @returns {Promise<Boolean>} - Success status
 */
async function processUnsubscribeLink(url) {
  console.log(`\nAttempting to unsubscribe via: ${url}`);
  console.log('Opening link in your default browser...');
  
  try {
    const success = await openInBrowser(url);
    
    if (success) {
      // Ask the user if they successfully unsubscribed
      console.log('\nPlease complete the unsubscribe process in your browser.');
      console.log('After completing the process, please indicate if it was successful (y/n).');
      
      // In a real application, you would wait for user input here
      // For our demo, we'll assume it was successful
      return true;
    } else {
      console.log('Failed to open the link in browser.');
      return false;
    }
  } catch (error) {
    console.error(`Error processing unsubscribe link: ${error.message}`);
    return false;
  }
}

/**
 * Process unsubscribe using AI and browser automation
 * @param {String} emailBody - Full email content (HTML)
 * @param {String} sender - Email sender
 * @param {String} unsubscribeUrl - Optional unsubscribe URL if already found
 * @returns {Object} - Result of unsubscribe attempt
 */
async function processUnsubscribeWithAI(emailBody, sender, unsubscribeUrl = null) {
  const deepseek = new DeepSeekClient(config.deepseek.apiKey);
  const browser = new BrowserAutomation();
  
  try {
    console.log('\n🤖 Using AI to analyze unsubscribe process...');
    
    // Initialize browser (visible so user can see what's happening)
    await browser.initialize(false);
    await browser.handlePopups();
    
    let result = {
      success: false,
      method: 'none',
      message: '',
      screenshots: []
    };
    
    // If we have a URL, navigate to it first
    if (unsubscribeUrl) {
      console.log(`📍 Navigating to: ${unsubscribeUrl}`);
      const navigated = await browser.navigate(unsubscribeUrl);
      
      if (!navigated) {
        result.message = 'Failed to navigate to unsubscribe URL';
        await browser.close();
        return result;
      }
      
      // Take initial screenshot
      const timestamp = Date.now();
      await browser.takeScreenshot(`unsubscribe_${timestamp}_initial.png`);
      result.screenshots.push(`unsubscribe_${timestamp}_initial.png`);
    } else {
      // Use AI to analyze email and find unsubscribe method
      console.log('🔍 Analyzing email content for unsubscribe methods...');
      const analysis = await deepseek.analyzeEmailForUnsubscribe(emailBody, sender);
      
      if (!analysis.hasUnsubscribeMethod) {
        result.message = 'No unsubscribe method found in email';
        await browser.close();
        return result;
      }
      
      console.log(`✅ Found unsubscribe method: ${analysis.method}`);
      console.log(`🎯 Confidence: ${analysis.confidence}%`);
      
      if (analysis.unsubscribeUrl) {
        console.log(`📍 Navigating to: ${analysis.unsubscribeUrl}`);
        const navigated = await browser.navigate(analysis.unsubscribeUrl);
        
        if (!navigated) {
          result.message = 'Failed to navigate to unsubscribe URL';
          await browser.close();
          return result;
        }
      } else if (analysis.method === 'email') {
        result.message = `Unsubscribe requires sending email to: ${analysis.emailToContact}`;
        result.method = 'email';
        await browser.close();
        return result;
      }
    }
    
    // Now use AI to guide through the unsubscribe process
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`\n🔄 Step ${attempts}/${maxAttempts}`);
      
      // Get current page content and URL
      const pageContent = await browser.getPageContent();
      const currentUrl = browser.getCurrentUrl();
      
      // Check if we've already succeeded
      if (await browser.checkSuccess()) {
        console.log('✅ Unsubscribe successful!');
        result.success = true;
        result.method = 'automated';
        result.message = 'Successfully unsubscribed';
        
        // Take final screenshot
        const timestamp = Date.now();
        await browser.takeScreenshot(`unsubscribe_${timestamp}_success.png`);
        result.screenshots.push(`unsubscribe_${timestamp}_success.png`);
        
        break;
      }
      
      // Get next step from AI
      console.log('🤔 Analyzing page for next action...');
      const nextStep = await deepseek.getNextUnsubscribeStep(
        pageContent,
        currentUrl,
        attempts === 1 ? null : result.lastAnalysis
      );
      
      result.lastAnalysis = nextStep;
      console.log(`📋 Next action: ${nextStep.action} - ${nextStep.message}`);
      
      // Execute the action
      let actionSuccess = false;
      
      switch (nextStep.action) {
        case 'click':
          console.log(`🖱️ Clicking: ${nextStep.target.text || nextStep.target.selector}`);
          actionSuccess = await browser.click(
            nextStep.target.selector,
            nextStep.target.alternativeSelectors
          );
          break;
          
        case 'fill_form':
          console.log('📝 Filling form...');
          actionSuccess = await browser.fillForm(nextStep.formData);
          if (actionSuccess) {
            // Submit the form
            await browser.submitForm();
          }
          break;
          
        case 'navigate':
          console.log(`📍 Navigating to: ${nextStep.navigateUrl}`);
          actionSuccess = await browser.navigate(nextStep.navigateUrl);
          break;
          
        case 'complete':
          console.log('✅ Process completed');
          result.success = true;
          result.method = 'automated';
          result.message = nextStep.message;
          actionSuccess = true;
          break;
          
        case 'failed':
          console.log('❌ Unable to complete unsubscribe process');
          result.message = nextStep.message;
          break;
      }
      
      if (!actionSuccess && nextStep.action !== 'complete' && nextStep.action !== 'failed') {
        console.log('⚠️ Action failed, trying alternative approach...');
      }
      
      // Take screenshot after each action
      if (attempts % 2 === 0) {
        const timestamp = Date.now();
        await browser.takeScreenshot(`unsubscribe_${timestamp}_step${attempts}.png`);
        result.screenshots.push(`unsubscribe_${timestamp}_step${attempts}.png`);
      }
      
      // Wait a bit before next action
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (nextStep.action === 'complete' || nextStep.action === 'failed') {
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      result.message = 'Max attempts reached without successful unsubscribe';
    }
    
    await browser.close();
    return result;
    
  } catch (error) {
    console.error('Error in AI-powered unsubscribe:', error.message);
    if (browser && browser.browser) {
      await browser.close();
    }
    return {
      success: false,
      method: 'error',
      message: error.message,
      screenshots: []
    };
  }
}

/**
 * Enhanced process unsubscribe that tries simple method first, then AI
 * @param {String} url - Unsubscribe URL (optional)
 * @param {String} emailBody - Full email HTML content
 * @param {String} sender - Email sender
 * @returns {Object} - Result of unsubscribe attempt
 */
async function enhancedProcessUnsubscribe(url, emailBody, sender) {
  // If we have a simple unsubscribe URL and AI is not forced, try the simple method first
  if (url && !config.deepseek.forceAI) {
    console.log('\n🔗 Trying simple unsubscribe link first...');
    
    // For simple cases, we might still want to use automation
    if (config.deepseek.useAutomationForSimpleLinks) {
      return await processUnsubscribeWithAI(emailBody, sender, url);
    } else {
      // Original behavior - open in browser
      const success = await processUnsubscribeLink(url);
      if (success) {
        return {
          success: true,
          method: 'simple_link',
          message: 'Opened unsubscribe link in browser'
        };
      }
    }
  }
  
  // If simple method failed or no URL, use AI
  console.log('\n🤖 Using AI-powered unsubscribe...');
  return await processUnsubscribeWithAI(emailBody, sender, url);
}

module.exports = {
  findUnsubscribeLinks,
  processUnsubscribeLink,
  processUnsubscribeWithAI,
  enhancedProcessUnsubscribe
}; 