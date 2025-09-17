const axios = require('axios');

class DeepSeekClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.deepseek.com/v1';
  }

  /**
   * Analyze email content to find unsubscribe instructions
   * @param {String} emailContent - HTML or text content of the email
   * @param {String} sender - Email sender information
   * @returns {Object} - Analysis result with unsubscribe strategy
   */
  async analyzeEmailForUnsubscribe(emailContent, sender) {
    try {
      const prompt = `You are an expert at analyzing emails to find unsubscribe methods. 
      
Analyze the following email and extract information about how to unsubscribe:

From: ${sender}
Email Content:
${this._cleanEmailContent(emailContent)}

Please provide a JSON response with the following structure:
{
  "hasUnsubscribeMethod": true/false,
  "method": "link" | "form" | "email" | "complex" | "none",
  "unsubscribeUrl": "URL if found",
  "instructions": ["Step-by-step instructions for unsubscribing"],
  "formFields": [{"name": "field_name", "value": "suggested_value", "type": "input_type"}] // if method is "form",
  "emailToContact": "email address if unsubscribe requires sending an email",
  "confidence": 0-100 // confidence level in the analysis
}

Focus on finding:
1. Unsubscribe links (look for words like "unsubscribe", "opt-out", "manage preferences", "email preferences")
2. Instructions about sending emails to unsubscribe
3. Forms that need to be filled
4. Any other unsubscribe methods mentioned`;

      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing emails and finding unsubscribe methods. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      
      // Try to parse the JSON response
      try {
        return JSON.parse(content);
      } catch (parseError) {
        // If parsing fails, extract JSON from the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse AI response as JSON');
      }
    } catch (error) {
      console.error('Error analyzing email with DeepSeek:', error.message);
      throw error;
    }
  }

  /**
   * Guide browser automation through a complex unsubscribe process
   * @param {String} pageContent - Current page HTML content
   * @param {String} currentUrl - Current page URL
   * @param {Object} previousAnalysis - Previous analysis result if available
   * @returns {Object} - Next steps for browser automation
   */
  async getNextUnsubscribeStep(pageContent, currentUrl, previousAnalysis = null) {
    try {
      const prompt = `You are guiding an automated browser through an unsubscribe process.

Current URL: ${currentUrl}
${previousAnalysis ? `Previous Analysis: ${JSON.stringify(previousAnalysis)}` : ''}

Current Page Content:
${this._cleanHtmlForAnalysis(pageContent)}

Analyze the current page and provide the next step to complete the unsubscribe process.

Respond with JSON:
{
  "action": "click" | "fill_form" | "select" | "navigate" | "complete" | "failed",
  "target": {
    "selector": "CSS selector or XPath",
    "alternativeSelectors": ["backup selectors"],
    "text": "visible text if clicking a link/button"
  },
  "formData": [{"selector": "input selector", "value": "value to enter"}] // if action is "fill_form",
  "navigateUrl": "URL to navigate to" // if action is "navigate",
  "isComplete": true/false,
  "message": "Human-readable explanation of what's happening",
  "confidence": 0-100
}

Look for:
1. Confirmation buttons ("Unsubscribe", "Confirm", "Yes", "Remove me")
2. Forms asking for email or reason for unsubscribing
3. Radio buttons or checkboxes for preferences
4. Success messages indicating completion`;

      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at web automation and form filling. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response.data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse AI response as JSON');
      }
    } catch (error) {
      console.error('Error getting next unsubscribe step:', error.message);
      throw error;
    }
  }

  /**
   * Clean email content for better analysis
   * @private
   */
  _cleanEmailContent(content) {
    // Remove excessive whitespace and limit content length
    let cleaned = content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Limit to first 5000 characters to avoid token limits
    return cleaned.substring(0, 5000);
  }

  /**
   * Clean HTML for page analysis, preserving structure
   * @private
   */
  _cleanHtmlForAnalysis(html) {
    // Remove scripts and styles but keep important HTML structure
    let cleaned = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
    
    // Extract only relevant parts (forms, links, buttons, text)
    const cheerio = require('cheerio');
    const $ = cheerio.load(cleaned);
    
    // Focus on interactive elements
    const relevantElements = [];
    
    $('form, button, a, input, select, textarea, [onclick]').each((i, elem) => {
      const $elem = $(elem);
      const tag = elem.tagName.toLowerCase();
      
      relevantElements.push({
        tag,
        text: $elem.text().trim().substring(0, 100),
        href: $elem.attr('href'),
        action: $elem.attr('action'),
        onclick: $elem.attr('onclick'),
        type: $elem.attr('type'),
        name: $elem.attr('name'),
        id: $elem.attr('id'),
        class: $elem.attr('class')
      });
    });
    
    // Also get any visible text that might contain instructions
    const bodyText = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000);
    
    return JSON.stringify({
      elements: relevantElements.slice(0, 50), // Limit elements
      bodyText
    }, null, 2);
  }
}

module.exports = DeepSeekClient;
