#!/usr/bin/env node

/**
 * Background Agent: System Monitor
 * Monitors API limits, authentication status, and system health
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

console.log('🔍 Background Agent: System Monitor Started');

const configPath = path.join(__dirname, '../../config/config.js');
const tokenPath = path.join(__dirname, '../../config/token.json');
const logsDir = path.join(__dirname, '../../logs');

// Health check results
const healthCheck = {
  timestamp: new Date().toISOString(),
  status: 'healthy',
  issues: [],
  metrics: {}
};

/**
 * Check Gmail API quota
 */
async function checkGmailQuota() {
  console.log('\n📊 Checking Gmail API quota...');
  
  // Parse recent logs to estimate API usage
  if (fs.existsSync(logsDir)) {
    const today = new Date().toISOString().split('T')[0];
    const todayLog = path.join(logsDir, `process-${today}.log`);
    
    if (fs.existsSync(todayLog)) {
      const content = fs.readFileSync(todayLog, 'utf8');
      const apiCalls = (content.match(/Fetched email/g) || []).length;
      
      healthCheck.metrics.gmailApiCallsToday = apiCalls;
      console.log(`   📈 API calls today: ${apiCalls}`);
      
      // Gmail API has a quota of 250 quota units per user per second
      // and 1,000,000,000 quota units per day
      if (apiCalls > 10000) {
        healthCheck.issues.push({
          severity: 'warning',
          message: 'High Gmail API usage detected',
          value: apiCalls
        });
      }
    }
  }
}

/**
 * Check DeepSeek API status
 */
async function checkDeepSeekAPI() {
  console.log('\n🤖 Checking DeepSeek API...');
  
  try {
    const config = require(configPath);
    if (!config.deepseek.apiKey) {
      healthCheck.issues.push({
        severity: 'error',
        message: 'DeepSeek API key not configured'
      });
      return;
    }
    
    // Make a minimal API call to check status
    const response = await axios.get('https://api.deepseek.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${config.deepseek.apiKey}`
      },
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('   ✅ DeepSeek API is accessible');
      healthCheck.metrics.deepseekStatus = 'online';
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      healthCheck.issues.push({
        severity: 'error',
        message: 'DeepSeek API key is invalid'
      });
    } else {
      healthCheck.issues.push({
        severity: 'warning',
        message: 'DeepSeek API unreachable',
        error: error.message
      });
    }
    healthCheck.metrics.deepseekStatus = 'offline';
  }
}

/**
 * Check authentication token
 */
function checkAuthToken() {
  console.log('\n🔐 Checking authentication token...');
  
  if (!fs.existsSync(tokenPath)) {
    healthCheck.issues.push({
      severity: 'error',
      message: 'No Gmail authentication token found'
    });
    return;
  }
  
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const expiryDate = token.expiry_date;
    
    if (expiryDate) {
      const now = Date.now();
      const daysUntilExpiry = Math.floor((expiryDate - now) / (24 * 60 * 60 * 1000));
      
      healthCheck.metrics.tokenDaysUntilExpiry = daysUntilExpiry;
      
      if (daysUntilExpiry < 0) {
        healthCheck.issues.push({
          severity: 'error',
          message: 'Gmail token has expired'
        });
      } else if (daysUntilExpiry < 7) {
        healthCheck.issues.push({
          severity: 'warning',
          message: `Gmail token expires in ${daysUntilExpiry} days`
        });
      } else {
        console.log(`   ✅ Token valid for ${daysUntilExpiry} more days`);
      }
    }
  } catch (error) {
    healthCheck.issues.push({
      severity: 'error',
      message: 'Error reading authentication token',
      error: error.message
    });
  }
}

/**
 * Check disk space
 */
function checkDiskSpace() {
  console.log('\n💾 Checking disk usage...');
  
  function getDirSize(dir) {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          size += stats.size;
        }
      });
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
    
    return size;
  }
  
  const screenshotsSize = getDirSize(path.join(__dirname, '../../screenshots'));
  const logsSize = getDirSize(logsDir);
  const totalSize = screenshotsSize + logsSize;
  
  healthCheck.metrics.diskUsageMB = (totalSize / 1024 / 1024).toFixed(2);
  
  console.log(`   📊 Total disk usage: ${healthCheck.metrics.diskUsageMB} MB`);
  
  // Warn if disk usage is high
  if (totalSize > 500 * 1024 * 1024) { // 500MB
    healthCheck.issues.push({
      severity: 'warning',
      message: 'High disk usage detected',
      value: `${healthCheck.metrics.diskUsageMB} MB`
    });
  }
}

/**
 * Check recent errors
 */
function checkRecentErrors() {
  console.log('\n❌ Checking recent errors...');
  
  if (!fs.existsSync(logsDir)) {
    return;
  }
  
  const recentErrors = [];
  const logFiles = fs.readdirSync(logsDir)
    .filter(f => f.endsWith('.log'))
    .sort()
    .slice(-3); // Last 3 log files
  
  logFiles.forEach(file => {
    const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
    const errorLines = content.split('\n').filter(line => 
      line.includes('Error') || 
      line.includes('Failed') || 
      line.includes('❌')
    );
    
    recentErrors.push(...errorLines.slice(-5)); // Last 5 errors per file
  });
  
  healthCheck.metrics.recentErrorCount = recentErrors.length;
  
  if (recentErrors.length > 10) {
    healthCheck.issues.push({
      severity: 'warning',
      message: `${recentErrors.length} errors found in recent logs`
    });
  }
  
  console.log(`   Found ${recentErrors.length} recent errors`);
}

/**
 * Generate health report
 */
function generateHealthReport() {
  // Determine overall status
  const errorCount = healthCheck.issues.filter(i => i.severity === 'error').length;
  const warningCount = healthCheck.issues.filter(i => i.severity === 'warning').length;
  
  if (errorCount > 0) {
    healthCheck.status = 'unhealthy';
  } else if (warningCount > 0) {
    healthCheck.status = 'degraded';
  }
  
  // Save health report
  const healthDir = path.join(__dirname, '../../health');
  if (!fs.existsSync(healthDir)) {
    fs.mkdirSync(healthDir, { recursive: true });
  }
  
  const reportPath = path.join(healthDir, 'health-check.json');
  fs.writeFileSync(reportPath, JSON.stringify(healthCheck, null, 2));
  
  console.log('\n📋 Health Check Summary:');
  console.log(`   Status: ${healthCheck.status.toUpperCase()}`);
  console.log(`   Issues: ${errorCount} errors, ${warningCount} warnings`);
  
  if (healthCheck.issues.length > 0) {
    console.log('\n⚠️  Issues found:');
    healthCheck.issues.forEach(issue => {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} ${issue.message}`);
    });
  }
  
  return healthCheck;
}

// Run all checks
async function runHealthChecks() {
  try {
    await checkGmailQuota();
    await checkDeepSeekAPI();
    checkAuthToken();
    checkDiskSpace();
    checkRecentErrors();
    
    const report = generateHealthReport();
    
    console.log('\n✅ System monitoring completed!');
    
    // Exit with error code if unhealthy
    if (report.status === 'unhealthy') {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Monitoring error:', error);
    process.exit(1);
  }
}

// Run checks
runHealthChecks();
