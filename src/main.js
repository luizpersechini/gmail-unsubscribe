const { authorize } = require('./auth/gmailAuth');
const { fetchPromotionEmails, getEmailBody, getEmailSubject, getEmailSender, deleteEmail, permanentlyDeleteEmail } = require('./email/emailFetcher');
const { findUnsubscribeLinks, processUnsubscribeLink, enhancedProcessUnsubscribe } = require('./unsubscribe/unsubscribeHandler');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify question function
function askQuestion(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

/**
 * Main application entry point
 */
async function main() {
  try {
    console.log('🚀 Starting AI-Powered Gmail Unsubscribe Tool...');
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // Authenticate with Gmail API
    console.log('🔐 Authenticating with Gmail...');
    const auth = await authorize();
    console.log('✅ Authentication successful!');
    
    // Fetch promotion emails
    console.log('📧 Fetching promotional emails...');
    const emails = await fetchPromotionEmails(auth);
    
    if (emails.length === 0) {
      console.log('No emails to process. Exiting.');
      rl.close();
      return;
    }
    
    // Limit to 10 emails for testing
    const emailsToProcess = emails.slice(0, 10);
    console.log(`📋 Processing ${emailsToProcess.length} emails...`);
    
    // Process each email
    let unsubscribeCount = 0;
    let failedUnsubscribes = [];
    
    for (let i = 0; i < emailsToProcess.length; i++) {
      const email = emailsToProcess[i];
      const subject = getEmailSubject(email);
      const sender = getEmailSender(email);
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📧 Email ${i + 1}/${emailsToProcess.length}`);
      console.log(`📨 From: ${sender}`);
      console.log(`📝 Subject: ${subject}`);
      console.log(`${'='.repeat(60)}`);
      
      // Extract email body and find unsubscribe links
      const emailBody = getEmailBody(email);
      const unsubscribeLinks = findUnsubscribeLinks(emailBody);
      
      console.log(`🔍 Found ${unsubscribeLinks.length} potential unsubscribe link(s)`);
      
      // Use enhanced unsubscribe process
      const firstLink = unsubscribeLinks.length > 0 ? unsubscribeLinks[0] : null;
      const result = await enhancedProcessUnsubscribe(firstLink, emailBody, sender);
      
      if (result.success) {
        unsubscribeCount++;
        console.log(`\n✅ Successfully unsubscribed from: ${sender}`);
        console.log(`   Method: ${result.method}`);
        
        if (result.screenshots && result.screenshots.length > 0) {
          console.log(`   📸 Screenshots saved: ${result.screenshots.join(', ')}`);
        }
        
        // Delete email if configured
        if (config.settings.deleteAfterUnsubscribe) {
          const deleteFunc = config.settings.permanentDelete ? permanentlyDeleteEmail : deleteEmail;
          await deleteFunc(auth, email.id);
        }
      } else {
        console.log(`\n❌ Failed to unsubscribe from: ${sender}`);
        console.log(`   Reason: ${result.message}`);
        
        failedUnsubscribes.push({
          sender,
          reason: result.message,
          method: result.method
        });
        
        // If it requires sending an email, log that for user
        if (result.method === 'email') {
          console.log(`   ✉️  Manual action required: Send unsubscribe email to address shown above`);
        }
      }
      
      // Ask if they want to continue to the next email (unless auto-continue is enabled)
      if (i < emailsToProcess.length - 1) {
        if (config.settings.autoContinue) {
          console.log('\n➡️  Auto-continuing to next email...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Short pause
        } else {
          try {
            const continueNext = await askQuestion('\n➡️  Continue to the next email? (y/n): ');
            if (continueNext.toLowerCase() !== 'y' && continueNext.toLowerCase() !== 'yes') {
              break;
            }
          } catch (error) {
            if (error.code === 'ERR_USE_AFTER_CLOSE') {
              console.log('\n⚠️  Auto-continuing to next email...');
              // Continue to next email if readline is closed
            } else {
              throw error;
            }
          }
        }
      }
    }
    
    // Display summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 UNSUBSCRIBE SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successfully unsubscribed: ${unsubscribeCount}`);
    console.log(`❌ Failed to unsubscribe: ${failedUnsubscribes.length}`);
    console.log(`📧 Total emails processed: ${Math.min(emailsToProcess.length, unsubscribeCount + failedUnsubscribes.length)}`);
    
    if (failedUnsubscribes.length > 0) {
      console.log('\n❌ Failed unsubscribes:');
      failedUnsubscribes.forEach(({ sender, reason, method }) => {
        console.log(`   - ${sender}`);
        console.log(`     Reason: ${reason}`);
        if (method === 'email') {
          console.log(`     Action: Send manual unsubscribe email`);
        }
      });
    }
    
    console.log(`\n📸 Screenshots saved in: ${screenshotsDir}`);
    console.log('\n✨ Process completed!');
    
    rl.close();
  } catch (error) {
    console.error('❌ An error occurred:', error);
    rl.close();
  }
}

// Run the application
main().catch(console.error); 