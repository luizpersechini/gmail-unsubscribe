const { google } = require('googleapis');
const config = require('../../config/config');

/**
 * Fetch emails from the Gmail Promotions category
 * @param {Object} auth - Authenticated Google OAuth2 client
 * @returns {Array} - List of email messages
 */
async function fetchPromotionEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const maxResults = config.settings.maxEmailsToProcess;
  
  try {
    // Get list of message IDs from the promotions category
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions',
      maxResults: maxResults,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      console.log('No promotion emails found.');
      return [];
    }

    console.log(`Found ${response.data.messages.length} promotional emails.`);
    
    // Fetch the full message content for each email
    const emails = [];
    for (const message of response.data.messages) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });
      
      emails.push(emailData.data);
      console.log(`Fetched email ${emails.length}/${response.data.messages.length}`);
    }
    
    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
}

/**
 * Get the email body content
 * @param {Object} message - Gmail message object
 * @returns {String} - Decoded email body
 */
function getEmailBody(message) {
  if (!message.payload) {
    return '';
  }
  
  // If the message has parts (multipart email)
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      // Look for the HTML part
      if (part.mimeType === 'text/html' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }
    
    // If no HTML part, try to get the first text part
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }
  }
  
  // If it's a simple message with no parts
  if (message.payload.body && message.payload.body.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf8');
  }
  
  return '';
}

/**
 * Extract the subject from email headers
 * @param {Object} message - Gmail message object
 * @returns {String} - Email subject
 */
function getEmailSubject(message) {
  if (!message.payload || !message.payload.headers) {
    return 'No Subject';
  }
  
  const subjectHeader = message.payload.headers.find(
    header => header.name.toLowerCase() === 'subject'
  );
  
  return subjectHeader ? subjectHeader.value : 'No Subject';
}

/**
 * Extract the sender from email headers
 * @param {Object} message - Gmail message object
 * @returns {String} - Email sender
 */
function getEmailSender(message) {
  if (!message.payload || !message.payload.headers) {
    return 'Unknown Sender';
  }
  
  const fromHeader = message.payload.headers.find(
    header => header.name.toLowerCase() === 'from'
  );
  
  return fromHeader ? fromHeader.value : 'Unknown Sender';
}

/**
 * Delete an email by moving it to trash
 * @param {Object} auth - Authenticated Google OAuth2 client
 * @param {String} messageId - Gmail message ID
 * @returns {Boolean} - Success status
 */
async function deleteEmail(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
    
    console.log('   🗑️  Email moved to trash');
    return true;
  } catch (error) {
    console.error('   ❌ Error deleting email:', error.message);
    return false;
  }
}

/**
 * Permanently delete an email (skip trash)
 * @param {Object} auth - Authenticated Google OAuth2 client
 * @param {String} messageId - Gmail message ID
 * @returns {Boolean} - Success status
 */
async function permanentlyDeleteEmail(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    await gmail.users.messages.delete({
      userId: 'me',
      id: messageId,
    });
    
    console.log('   🗑️  Email permanently deleted');
    return true;
  } catch (error) {
    console.error('   ❌ Error permanently deleting email:', error.message);
    return false;
  }
}

module.exports = {
  fetchPromotionEmails,
  getEmailBody,
  getEmailSubject,
  getEmailSender,
  deleteEmail,
  permanentlyDeleteEmail,
}; 