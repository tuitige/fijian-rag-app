#!/usr/bin/env node

/**
 * Quick Frontend Configuration Script
 * 
 * This lightweight script just extracts the API URL and creates .env file
 * Useful for development when you don't need a full build/deploy
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STACK_NAME = 'FijianRagAppStack';
const TARGET_REGION = 'us-west-2'; // Explicitly target us-west-2
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const ENV_FILE_PATH = path.join(FRONTEND_DIR, '.env');

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

function main() {
  console.log(`🔧 Configuring frontend with deployed API URL from ${TARGET_REGION}...`);
  
  try {
    // Get stack outputs
    const outputsCommand = `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${TARGET_REGION} --query "Stacks[0].Outputs" --output json`;
    const outputsJson = execCommand(outputsCommand);
    const outputs = JSON.parse(outputsJson);
    
    const outputMap = {};
    outputs.forEach(output => {
      outputMap[output.OutputKey] = output.OutputValue;
    });
    
    // Find API URL
    const apiUrl = outputMap.UnifiedApiUrl || outputMap.fijianaiapiEndpointC4A3E626;
    if (!apiUrl) {
      console.error('❌ API URL not found in stack outputs');
      console.log('Available outputs:', Object.keys(outputMap));
      process.exit(1);
    }
    
    // Create .env file
    const envContent = `# Frontend Configuration - Auto-generated
REACT_APP_API_BASE_URL=${apiUrl}
REACT_APP_ENVIRONMENT=${outputMap.Environment || 'dev'}
`;
    
    fs.writeFileSync(ENV_FILE_PATH, envContent);
    
    console.log('✅ Frontend configured successfully!');
    console.log(`   API URL: ${apiUrl}`);
    console.log(`   Environment: ${outputMap.Environment || 'dev'}`);
    console.log(`   Config file: ${ENV_FILE_PATH}`);
    console.log('\n🚀 You can now run: cd frontend && npm start');
    
  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
    console.log('\nMake sure:');
    console.log('1. AWS CLI is configured');
    console.log('2. CDK stack is deployed');
    console.log('3. You have CloudFormation describe permissions');
    process.exit(1);
  }
}

main();
