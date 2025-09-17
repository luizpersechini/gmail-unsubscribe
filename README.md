# Gmail Unsubscribe Tool

An AI-powered tool to automatically unsubscribe from promotional emails in your Gmail account.

## How It Works

1. The tool authenticates with your Gmail account
2. It scans your promotions tab for emails
3. For each email, it looks for unsubscribe links
4. **NEW**: If a simple unsubscribe link isn't found or the process is complex:
   - Uses DeepSeek AI to analyze the email content
   - Automatically navigates through complex unsubscribe forms
   - Handles multi-step processes, form filling, and confirmations
5. Takes screenshots of the process for verification

## Prerequisites

- Node.js (version 14 or higher)
- A Google account with Gmail
- Google API credentials (see Setup below)

## Setup

### 1. Create Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Gmail API for your project
4. Create OAuth 2.0 credentials (Web application type)
5. Add `http://localhost:3000/oauth2callback` as an authorized redirect URI
6. Download the credentials JSON file

### 2. Configure the Application

1. Clone this repository
2. Run `npm install` to install dependencies
3. Create a `.env` file in the root directory with the following content:
   ```
   # Gmail API Configuration
   CLIENT_ID=your_client_id_from_google
   CLIENT_SECRET=your_client_secret_from_google
   REDIRECT_URI=http://localhost:3000/oauth2callback
   
   # Email Processing Settings
   MAX_EMAILS_TO_PROCESS=50
   
   # DeepSeek API Configuration (Required for AI-powered unsubscribe)
   DEEPSEEK_API_KEY=your_deepseek_api_key
   
   # AI Unsubscribe Settings (Optional)
   FORCE_AI_UNSUBSCRIBE=false  # Set to true to always use AI
   USE_AUTOMATION_FOR_SIMPLE_LINKS=true  # Set to false for manual browser opening
   AUTO_CONTINUE=false  # Set to true to automatically continue to next email without prompting
   
   # Email Management Settings (Optional)
   DELETE_AFTER_UNSUBSCRIBE=false  # Set to true to delete emails after successful unsubscribe
   PERMANENT_DELETE=false  # Set to true to permanently delete (skip trash)
   ```

### 3. Get DeepSeek API Key

1. Sign up at [DeepSeek](https://platform.deepseek.com/)
2. Generate an API key from your dashboard
3. Add the API key to your `.env` file

## Usage

Run the application with:

```
node src/main.js
```

The first time you run the application, it will open a browser window and ask you to authorize the application to access your Gmail account. Follow the instructions to authorize the application and copy the code into the terminal when prompted.

The tool will then:
1. Find promotional emails in your Gmail account
2. Identify unsubscribe links in those emails
3. Open each link in a browser window and attempt to complete the unsubscription process
4. Show you a summary of the results

## Important Notes

- The tool opens a visible browser window so you can see what's happening
- **AI-Powered**: Now handles complex unsubscribe processes automatically using DeepSeek AI
- Screenshots are saved in the `screenshots/` directory for verification
- The tool will indicate whether each unsubscribe was successful
- For emails requiring you to send an unsubscribe email, the tool will notify you of the email address

## Customization

- Change `MAX_EMAILS_TO_PROCESS` in the `.env` file to process more or fewer emails
- Modify the selectors in `unsubscribeHandler.js` to handle different types of unsubscribe forms
- Edit the Gmail query in `emailFetcher.js` to target different types of emails

## License

This project is licensed under the MIT License. 