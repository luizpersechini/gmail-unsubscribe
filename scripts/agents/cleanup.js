#!/usr/bin/env node

/**
 * Background Agent: Cleanup
 * Removes old screenshots, logs, and temporary files
 */

const fs = require('fs');
const path = require('path');

const DAYS_TO_KEEP_SCREENSHOTS = 7;
const DAYS_TO_KEEP_LOGS = 30;

console.log('🧹 Background Agent: Cleanup Started');

// Directories to clean
const screenshotsDir = path.join(__dirname, '../../screenshots');
const logsDir = path.join(__dirname, '../../logs');

/**
 * Delete files older than specified days
 */
function cleanOldFiles(directory, daysToKeep, pattern = /.*/) {
  if (!fs.existsSync(directory)) {
    console.log(`📁 Directory not found: ${directory}`);
    return { deleted: 0, kept: 0 };
  }

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  let keptCount = 0;

  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    if (!pattern.test(file)) return;
    
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      const age = now - stats.mtime.getTime();
      
      if (age > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`   🗑️  Deleted: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)`);
        deletedCount++;
      } else {
        keptCount++;
      }
    }
  });

  return { deleted: deletedCount, kept: keptCount };
}

/**
 * Clean up screenshots
 */
function cleanScreenshots() {
  console.log('\n📸 Cleaning old screenshots...');
  const result = cleanOldFiles(screenshotsDir, DAYS_TO_KEEP_SCREENSHOTS, /\.(png|jpg|jpeg)$/i);
  console.log(`   ✅ Deleted ${result.deleted} old screenshots, kept ${result.kept}`);
}

/**
 * Clean up logs
 */
function cleanLogs() {
  console.log('\n📝 Cleaning old logs...');
  const result = cleanOldFiles(logsDir, DAYS_TO_KEEP_LOGS, /\.log$/i);
  console.log(`   ✅ Deleted ${result.deleted} old logs, kept ${result.kept}`);
}

/**
 * Check disk usage
 */
function checkDiskUsage() {
  console.log('\n💾 Checking disk usage...');
  
  function getDirSize(dir) {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        size += stats.size;
      } else if (stats.isDirectory()) {
        size += getDirSize(filePath);
      }
    });
    
    return size;
  }
  
  const screenshotsSize = getDirSize(screenshotsDir);
  const logsSize = getDirSize(logsDir);
  
  console.log(`   📸 Screenshots: ${(screenshotsSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   📝 Logs: ${(logsSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   📊 Total: ${((screenshotsSize + logsSize) / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Validate token
 */
function checkAuthToken() {
  console.log('\n🔐 Checking authentication token...');
  const tokenPath = path.join(__dirname, '../../config/token.json');
  
  if (!fs.existsSync(tokenPath)) {
    console.log('   ⚠️  No authentication token found');
    return;
  }
  
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const expiryDate = token.expiry_date;
    
    if (expiryDate) {
      const now = Date.now();
      const daysUntilExpiry = Math.floor((expiryDate - now) / (24 * 60 * 60 * 1000));
      
      if (daysUntilExpiry < 0) {
        console.log('   ❌ Token has expired!');
      } else if (daysUntilExpiry < 7) {
        console.log(`   ⚠️  Token expires in ${daysUntilExpiry} days`);
      } else {
        console.log(`   ✅ Token valid for ${daysUntilExpiry} more days`);
      }
    }
  } catch (error) {
    console.log('   ❌ Error reading token:', error.message);
  }
}

// Run cleanup tasks
console.log('Starting cleanup tasks...\n');

try {
  cleanScreenshots();
  cleanLogs();
  checkDiskUsage();
  checkAuthToken();
  
  console.log('\n✅ Cleanup completed successfully!');
} catch (error) {
  console.error('\n❌ Cleanup error:', error);
  process.exit(1);
}
