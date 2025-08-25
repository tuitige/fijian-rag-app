#!/usr/bin/env node

// API Testing Script for Fijian RAG App
const https = require('https');

const API_URLS = [
  'https://0wujtxlvc0.execute-api.us-west-2.amazonaws.com/prod/',
  'https://qbfl8hrn0g.execute-api.us-west-2.amazonaws.com/prod/'
];

const TEST_ENDPOINTS = [
  '',
  'chat',
  'dictionary/search',
  'learn'
];

async function testUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      console.log(`✅ ${url} - Status: ${res.statusCode}`);
      resolve({ url, status: res.statusCode, success: true });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${url} - Error: ${err.message}`);
      resolve({ url, status: 'ERROR', success: false, error: err.message });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`⏰ ${url} - Timeout`);
      resolve({ url, status: 'TIMEOUT', success: false });
    });
  });
}

async function testAllEndpoints() {
  console.log('🧪 Testing Fijian RAG App API Endpoints\n');
  
  for (const apiUrl of API_URLS) {
    console.log(`\n🔍 Testing API: ${apiUrl}`);
    console.log(''.padEnd(60, '-'));
    
    const results = [];
    for (const endpoint of TEST_ENDPOINTS) {
      const fullUrl = `${apiUrl}${endpoint}`;
      const result = await testUrl(fullUrl);
      results.push(result);
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`\n📊 Results: ${successful}/${results.length} endpoints responding\n`);
  }
  
  console.log('🎯 If the old API (qbfl8hrn0g) is still responding, we need to update the frontend cache.');
  console.log('🎯 If the new API (0wujtxlvc0) is responding, the frontend should use it after cache invalidation.');
}

testAllEndpoints().catch(console.error);
