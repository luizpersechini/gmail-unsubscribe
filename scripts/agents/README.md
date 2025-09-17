# Gmail Unsubscribe Background Agents

This directory contains background agent scripts that can be run automatically by Cursor or manually for various maintenance and processing tasks.

## Available Agents

### 1. Email Processor (`processEmails.js`)
Automatically processes promotional emails and unsubscribes using AI.

**Schedule**: Twice daily (9 AM and 5 PM)
```bash
npm run agent:process
```

**Features**:
- Processes emails with AI-powered unsubscribe
- Auto-continues without prompting
- Deletes emails after successful unsubscribe
- Logs all activities

### 2. Cleanup Agent (`cleanup.js`)
Removes old screenshots and logs to manage disk space.

**Schedule**: Daily at 2 AM
```bash
npm run agent:cleanup
```

**Features**:
- Deletes screenshots older than 7 days
- Deletes logs older than 30 days
- Reports disk usage
- Checks authentication token validity

### 3. Report Generator (`generateReport.js`)
Creates HTML and JSON reports of unsubscribe activities.

**Schedule**: Daily at 10 PM
```bash
npm run agent:report
```

**Features**:
- Generates statistics from logs
- Creates HTML report with charts
- Exports JSON data for further analysis
- Shows top senders and daily activity

### 4. System Monitor (`monitor.js`)
Monitors system health, API limits, and authentication status.

**Schedule**: Every 6 hours
```bash
npm run agent:monitor
```

**Features**:
- Checks Gmail API quota usage
- Validates DeepSeek API connectivity
- Monitors authentication token expiry
- Tracks disk usage
- Reports recent errors

## Running All Agents

To run all maintenance agents in sequence:
```bash
npm run agent:all
```

## Configuration

Agents respect environment variables from `.env`:
- `AUTO_CONTINUE=true` - Process without prompting
- `DELETE_AFTER_UNSUBSCRIBE=true` - Delete emails after unsubscribe
- `MAX_EMAILS_TO_PROCESS=20` - Limit emails per session

## Cursor Background Agent Setup

1. Cursor will automatically detect `.cursorrules` and `.cursor/agents.json`
2. Enable background agents in Cursor settings
3. Agents will run according to their schedules
4. Check logs in the `logs/` directory for agent activity

## Manual Execution

You can run any agent manually:
```bash
# Process 5 emails quickly
MAX_EMAILS_TO_PROCESS=5 npm run agent:process

# Generate report for specific date
npm run agent:report

# Check system health
npm run agent:health
```

## Logs and Reports

- **Logs**: `logs/` directory contains daily logs
- **Reports**: `reports/` directory contains generated reports
- **Health**: `health/` directory contains system health checks
- **Screenshots**: `screenshots/` directory contains process evidence

## Troubleshooting

1. **Authentication errors**: Delete `config/token.json` and re-authenticate
2. **API limits**: Check `health/health-check.json` for quota usage
3. **Disk space**: Run cleanup agent more frequently
4. **Failed unsubscribes**: Check screenshots for manual intervention needed
