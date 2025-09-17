const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../../config/config');

// Create an OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  config.gmail.clientId,
  config.gmail.clientSecret,
  config.gmail.redirectUri
);

// Token file path
const TOKEN_PATH = path.join(__dirname, '../../config/token.json');

/**
 * Get and store new token after prompting for user authorization
 */
async function getNewToken() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
  });
  
  console.log('Authorize this app by visiting this URL:', authUrl);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', async (code) => {
      rl.close();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        
        // Store the token to disk for later program executions
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);
        resolve(oAuth2Client);
      } catch (err) {
        console.error('Error retrieving access token', err);
        reject(err);
      }
    });
  });
}

/**
 * Load saved token or get a new one
 */
async function authorize() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    } else {
      return await getNewToken();
    }
  } catch (err) {
    console.error('Error loading client secret file:', err);
    throw err;
  }
}

module.exports = {
  authorize,
}; 