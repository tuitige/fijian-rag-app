#!/usr/bin/env node

/**
 * Frontend Deployment Script
 * 
 * This script:
 * 1. Extracts API Gateway URL from CDK stack outputs
 * 2. Generates .env file for React frontend
 * 3. Builds the frontend with correct configuration
 * 4. Optionally uploads to S3 bucket
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const STACK_NAME = 'FijianRagAppStack';
const TARGET_REGION = 'us-west-2'; // Explicitly target us-west-2
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const ENV_FILE_PATH = path.join(FRONTEND_DIR, '.env');

/**
 * Execute command and return output
 */
function execCommand(command, options = {}) {
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      ...options 
    });
    return output.trim();
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Get CDK stack outputs
 */
function getCdkOutputs() {
  console.log('📡 Fetching CDK stack outputs...');
  
  try {
    // Check if stack exists by trying to describe it directly
    console.log(`   Checking if stack ${STACK_NAME} exists in ${TARGET_REGION}...`);
    const outputsCommand = `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${TARGET_REGION} --query "Stacks[0].Outputs" --output json`;
    const outputsJson = execCommand(outputsCommand);
    const outputs = JSON.parse(outputsJson);
    
    const outputMap = {};
    outputs.forEach(output => {
      outputMap[output.OutputKey] = output.OutputValue;
    });
    
    console.log('✅ CDK outputs retrieved successfully');
    console.log(`   Found ${outputs.length} outputs`);
    return outputMap;
    
  } catch (error) {
    console.error('❌ Failed to get CDK outputs:', error.message);
    console.log('\nMake sure:');
    console.log('1. AWS CLI is configured');
    console.log('2. CDK stack is deployed');
    console.log('3. You have permissions to describe CloudFormation stacks');
    process.exit(1);
  }
}

/**
 * Generate .env file for React frontend
 */
function generateEnvFile(outputs) {
  console.log('📝 Generating frontend .env file...');
  
  const apiUrl = outputs.UnifiedApiUrl || outputs.fijianaiapiEndpointC4A3E626;
  if (!apiUrl) {
    console.error('❌ API URL not found in stack outputs');
    console.log('Available outputs:', Object.keys(outputs));
    process.exit(1);
  }

  const envContent = `# Generated automatically by deploy-frontend.js
# Last updated: ${new Date().toISOString()}

# API Configuration
REACT_APP_API_BASE_URL=${apiUrl}

# Environment
REACT_APP_ENVIRONMENT=${outputs.Environment || 'dev'}

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_ERROR_REPORTING=true

# Build Configuration
GENERATE_SOURCEMAP=false
`;

  fs.writeFileSync(ENV_FILE_PATH, envContent);
  console.log('✅ Environment file created:', ENV_FILE_PATH);
  console.log(`   API URL: ${apiUrl}`);
}

/**
 * Build React frontend
 */
function buildFrontend() {
  console.log('🔨 Building React frontend...');
  
  try {
    // Install dependencies if needed
    if (!fs.existsSync(path.join(FRONTEND_DIR, 'node_modules'))) {
      console.log('📦 Installing frontend dependencies...');
      execCommand('npm install', { cwd: FRONTEND_DIR });
    }
    
    // Build the frontend
    execCommand('npm run build', { cwd: FRONTEND_DIR });
    console.log('✅ Frontend build completed successfully');
    
    // Verify build directory exists
    const buildDir = path.join(FRONTEND_DIR, 'build');
    if (!fs.existsSync(buildDir)) {
      throw new Error('Build directory not found after build completion');
    }
    
    console.log('📁 Build artifacts available at:', buildDir);
    
  } catch (error) {
    console.error('❌ Frontend build failed:', error.message);
    process.exit(1);
  }
}

/**
 * Upload to S3 bucket (optional)
 */
function uploadToS3(outputs) {
  const bucketName = outputs.FrontendBucketName;
  if (!bucketName) {
    console.log('⚠️  Frontend bucket name not found in outputs, skipping S3 upload');
    return;
  }

  console.log(`📤 Uploading frontend to S3 bucket: ${bucketName}`);
  
  try {
    const buildDir = path.join(FRONTEND_DIR, 'build');
    const syncCommand = `aws s3 sync ${buildDir} s3://${bucketName} --delete`;
    
    execCommand(syncCommand);
    console.log('✅ Frontend uploaded to S3 successfully');
    
    // Set cache headers for optimization
    const cacheCommands = [
      `aws s3 cp s3://${bucketName} s3://${bucketName} --recursive --exclude "*" --include "*.html" --cache-control "no-cache"`,
      `aws s3 cp s3://${bucketName} s3://${bucketName} --recursive --exclude "*" --include "*.js" --cache-control "max-age=31536000"`,
      `aws s3 cp s3://${bucketName} s3://${bucketName} --recursive --exclude "*" --include "*.css" --cache-control "max-age=31536000"`
    ];
    
    cacheCommands.forEach(command => {
      try {
        execCommand(command);
      } catch (error) {
        console.warn('⚠️  Cache header setup failed (non-critical):', error.message);
      }
    });
    
  } catch (error) {
    console.error('❌ S3 upload failed:', error.message);
    console.log('Build completed but upload failed. You can manually upload the build directory.');
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting frontend deployment process...\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipUpload = args.includes('--skip-upload');
  const configOnly = args.includes('--config-only');
  
  try {
    // Step 1: Get CDK outputs
    const outputs = getCdkOutputs();
    
    // Step 2: Generate environment file
    generateEnvFile(outputs);
    
    if (configOnly) {
      console.log('✅ Configuration complete (--config-only flag used)');
      return;
    }
    
    // Step 3: Build frontend
    buildFrontend();
    
    // Step 4: Upload to S3 (optional)
    if (!skipUpload) {
      uploadToS3(outputs);
    } else {
      console.log('⏭️  Skipping S3 upload (--skip-upload flag used)');
    }
    
    console.log('\n🎉 Frontend deployment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test the frontend locally: cd frontend && npm start');
    console.log('2. Access your application via the API Gateway URL or CloudFront distribution');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Frontend Deployment Script

Usage: node scripts/deploy-frontend.js [options]

Options:
  --config-only    Only generate .env file, skip build and upload
  --skip-upload    Build frontend but skip S3 upload
  --help, -h       Show this help message

Examples:
  node scripts/deploy-frontend.js                    # Full deployment
  node scripts/deploy-frontend.js --config-only      # Just generate .env
  node scripts/deploy-frontend.js --skip-upload      # Build but don't upload

Prerequisites:
  - AWS CLI configured
  - CDK stack deployed
  - Node.js and npm installed
`);
  process.exit(0);
}

// Run the script
main();
