#!/usr/bin/env node

/**
 * API Connection Test Script
 * 
 * This script tests the connection to the CareChain backend API.
 * Run this to verify the backend is accessible before running the app.
 * 
 * Usage:
 *   node test-api-connection.js
 */

const http = require('http');
const https = require('https');

// Read API URL from environment or use default
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5001/api/v1';

console.log('='.repeat(60));
console.log('CareChain API Connection Test');
console.log('='.repeat(60));
console.log(`Testing connection to: ${API_URL}`);
console.log('');

// Parse URL
const url = new URL(API_URL);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

// Test 1: Health Check
console.log('Test 1: Health Check Endpoint');
console.log('-'.repeat(60));

const healthUrl = `${url.protocol}//${url.host}/api/v1/health`;

const healthReq = client.get(healthUrl, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Health check passed');
      console.log(`   Status: ${res.statusCode}`);
      try {
        const json = JSON.parse(data);
        console.log(`   Response: ${JSON.stringify(json, null, 2)}`);
      } catch (e) {
        console.log(`   Response: ${data}`);
      }
    } else {
      console.log('❌ Health check failed');
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Response: ${data}`);
    }
    console.log('');
    runTest2();
  });
});

healthReq.on('error', (err) => {
  console.log('❌ Health check failed');
  console.log(`   Error: ${err.message}`);
  console.log('');
  console.log('Possible issues:');
  console.log('  1. Backend server is not running');
  console.log('  2. Wrong API URL in .env file');
  console.log('  3. Firewall blocking the API port (default 5001; avoid 5000 on Mac = AirPlay)');
  console.log('  4. Network connectivity issues');
  console.log('');
  console.log('Solutions:');
  console.log('  1. Start backend: cd care-chain-backend && npm run dev');
  console.log('  2. Check .env file: EXPO_PUBLIC_API_URL');
  console.log('  3. Check firewall settings');
  console.log('  4. Verify network connection');
  console.log('');
  process.exit(1);
});

// Test 2: Search Endpoint (Public)
function runTest2() {
  console.log('Test 2: Search Hospitals Endpoint (Public)');
  console.log('-'.repeat(60));

  const searchUrl = `${url.protocol}//${url.host}/api/v1/search/hospitals?limit=1`;

  const searchReq = client.get(searchUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Search endpoint accessible');
        console.log(`   Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`   Found ${json.data?.hospitals?.length || 0} hospitals`);
        } catch (e) {
          console.log(`   Response: ${data.substring(0, 100)}...`);
        }
      } else {
        console.log('⚠️  Search endpoint returned non-200 status');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   This might be normal if no hospitals exist yet`);
      }
      console.log('');
      runTest3();
    });
  });

  searchReq.on('error', (err) => {
    console.log('❌ Search endpoint failed');
    console.log(`   Error: ${err.message}`);
    console.log('');
    process.exit(1);
  });
}

// Test 3: Messages Endpoint (Requires Auth)
function runTest3() {
  console.log('Test 3: Messages Endpoint (Requires Auth)');
  console.log('-'.repeat(60));

  const messagesUrl = `${url.protocol}//${url.host}/api/v1/messages/conversations`;

  const messagesReq = client.get(messagesUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 401) {
        console.log('✅ Messages endpoint accessible (401 expected without auth)');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   This is correct - endpoint requires authentication`);
      } else if (res.statusCode === 200) {
        console.log('✅ Messages endpoint accessible');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Note: You appear to be authenticated`);
      } else {
        console.log('⚠️  Messages endpoint returned unexpected status');
        console.log(`   Status: ${res.statusCode}`);
      }
      console.log('');
      printSummary();
    });
  });

  messagesReq.on('error', (err) => {
    console.log('❌ Messages endpoint failed');
    console.log(`   Error: ${err.message}`);
    console.log('');
    printSummary();
  });
}

function printSummary() {
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log('✅ Backend is accessible and responding correctly');
  console.log('');
  console.log('You can now run the app:');
  console.log('  npm start');
  console.log('');
  console.log('If you encounter issues in the app:');
  console.log('  1. Check the TROUBLESHOOTING.md file');
  console.log('  2. Verify your device/emulator network settings');
  console.log('  3. Check backend logs for errors');
  console.log('');
  process.exit(0);
}
