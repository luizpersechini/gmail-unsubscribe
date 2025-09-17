require('dotenv').config();

module.exports = {
  gmail: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
  },
  settings: {
    maxEmailsToProcess: process.env.MAX_EMAILS_TO_PROCESS || 50,
    autoContinue: process.env.AUTO_CONTINUE === 'true' || false,
    deleteAfterUnsubscribe: process.env.DELETE_AFTER_UNSUBSCRIBE === 'true' || false,
    permanentDelete: process.env.PERMANENT_DELETE === 'true' || false, // If true, skip trash
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    forceAI: process.env.FORCE_AI_UNSUBSCRIBE === 'true' || false,
    useAutomationForSimpleLinks: process.env.USE_AUTOMATION_FOR_SIMPLE_LINKS === 'true' || true,
  }
}; 