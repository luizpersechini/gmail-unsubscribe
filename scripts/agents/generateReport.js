#!/usr/bin/env node

/**
 * Background Agent: Generate Report
 * Creates reports on unsubscribe activities
 */

const fs = require('fs');
const path = require('path');

console.log('📊 Background Agent: Report Generation Started');

const logsDir = path.join(__dirname, '../../logs');
const reportsDir = path.join(__dirname, '../../reports');
const screenshotsDir = path.join(__dirname, '../../screenshots');

// Create reports directory if it doesn't exist
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Parse log files to extract unsubscribe data
 */
function parseLogFiles() {
  if (!fs.existsSync(logsDir)) {
    console.log('❌ No logs directory found');
    return [];
  }

  const activities = [];
  const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));

  logFiles.forEach(file => {
    const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
    const lines = content.split('\n');

    lines.forEach(line => {
      // Extract successful unsubscribes
      if (line.includes('Successfully unsubscribed from:')) {
        const match = line.match(/\[([^\]]+)\].*Successfully unsubscribed from: (.+)/);
        if (match) {
          activities.push({
            timestamp: match[1],
            action: 'unsubscribed',
            sender: match[2],
            status: 'success'
          });
        }
      }

      // Extract failed unsubscribes
      if (line.includes('Failed to unsubscribe from:')) {
        const match = line.match(/\[([^\]]+)\].*Failed to unsubscribe from: (.+)/);
        if (match) {
          activities.push({
            timestamp: match[1],
            action: 'unsubscribe_failed',
            sender: match[2],
            status: 'failed'
          });
        }
      }

      // Extract deleted emails
      if (line.includes('Email moved to trash')) {
        const prevLine = lines[lines.indexOf(line) - 1] || '';
        const match = prevLine.match(/Successfully unsubscribed from: (.+)/);
        if (match) {
          activities.push({
            timestamp: line.match(/\[([^\]]+)\]/)?.[1] || new Date().toISOString(),
            action: 'email_deleted',
            sender: match[1],
            status: 'success'
          });
        }
      }
    });
  });

  return activities;
}

/**
 * Generate statistics from activities
 */
function generateStats(activities) {
  const stats = {
    totalProcessed: 0,
    successfulUnsubscribes: 0,
    failedUnsubscribes: 0,
    emailsDeleted: 0,
    topSenders: {},
    dailyActivity: {},
    successRate: 0
  };

  activities.forEach(activity => {
    const date = new Date(activity.timestamp).toISOString().split('T')[0];
    
    // Daily activity
    if (!stats.dailyActivity[date]) {
      stats.dailyActivity[date] = {
        successful: 0,
        failed: 0,
        deleted: 0
      };
    }

    // Count by type
    if (activity.action === 'unsubscribed') {
      stats.successfulUnsubscribes++;
      stats.dailyActivity[date].successful++;
      stats.totalProcessed++;
    } else if (activity.action === 'unsubscribe_failed') {
      stats.failedUnsubscribes++;
      stats.dailyActivity[date].failed++;
      stats.totalProcessed++;
    } else if (activity.action === 'email_deleted') {
      stats.emailsDeleted++;
      stats.dailyActivity[date].deleted++;
    }

    // Top senders
    const sender = activity.sender;
    if (!stats.topSenders[sender]) {
      stats.topSenders[sender] = 0;
    }
    stats.topSenders[sender]++;
  });

  // Calculate success rate
  if (stats.totalProcessed > 0) {
    stats.successRate = ((stats.successfulUnsubscribes / stats.totalProcessed) * 100).toFixed(2);
  }

  // Sort top senders
  stats.topSendersList = Object.entries(stats.topSenders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sender, count]) => ({ sender, count }));

  return stats;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(stats) {
  const reportDate = new Date().toISOString().split('T')[0];
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Gmail Unsubscribe Report - ${reportDate}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1, h2 { color: #333; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 2em; font-weight: bold; color: #1a73e8; }
    .stat-label { color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; }
    .success { color: #0f9d58; }
    .failed { color: #ea4335; }
    .chart { margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Gmail Unsubscribe Report</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${stats.totalProcessed}</div>
        <div class="stat-label">Total Processed</div>
      </div>
      <div class="stat-card">
        <div class="stat-number success">${stats.successfulUnsubscribes}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-number failed">${stats.failedUnsubscribes}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.successRate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>

    <h2>📧 Top Senders</h2>
    <table>
      <tr>
        <th>Sender</th>
        <th>Count</th>
      </tr>
      ${stats.topSendersList.map(item => `
        <tr>
          <td>${item.sender}</td>
          <td>${item.count}</td>
        </tr>
      `).join('')}
    </table>

    <h2>📅 Daily Activity</h2>
    <table>
      <tr>
        <th>Date</th>
        <th>Successful</th>
        <th>Failed</th>
        <th>Deleted</th>
      </tr>
      ${Object.entries(stats.dailyActivity).reverse().map(([date, data]) => `
        <tr>
          <td>${date}</td>
          <td class="success">${data.successful}</td>
          <td class="failed">${data.failed}</td>
          <td>${data.deleted}</td>
        </tr>
      `).join('')}
    </table>
  </div>
</body>
</html>
  `;

  const reportPath = path.join(reportsDir, `report-${reportDate}.html`);
  fs.writeFileSync(reportPath, html);
  console.log(`   ✅ HTML report saved to: ${reportPath}`);
  
  return reportPath;
}

/**
 * Generate JSON report
 */
function generateJSONReport(stats) {
  const reportDate = new Date().toISOString().split('T')[0];
  const reportPath = path.join(reportsDir, `report-${reportDate}.json`);
  
  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    meta: {
      screenshotCount: fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir).length : 0,
      logFileCount: fs.existsSync(logsDir) ? fs.readdirSync(logsDir).length : 0
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`   ✅ JSON report saved to: ${reportPath}`);
  
  return reportPath;
}

// Generate reports
try {
  console.log('📈 Analyzing activity logs...');
  const activities = parseLogFiles();
  
  if (activities.length === 0) {
    console.log('❌ No activities found in logs');
    process.exit(0);
  }
  
  console.log(`   Found ${activities.length} activities`);
  
  console.log('\n📊 Generating statistics...');
  const stats = generateStats(activities);
  
  console.log('\n📝 Creating reports...');
  const htmlReport = generateHTMLReport(stats);
  const jsonReport = generateJSONReport(stats);
  
  console.log('\n✅ Report generation completed!');
  console.log('\n📊 Summary:');
  console.log(`   - Total Processed: ${stats.totalProcessed}`);
  console.log(`   - Success Rate: ${stats.successRate}%`);
  console.log(`   - Emails Deleted: ${stats.emailsDeleted}`);
  
} catch (error) {
  console.error('❌ Report generation error:', error);
  process.exit(1);
}
