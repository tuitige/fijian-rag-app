# Fijian RAG App Infrastructure

This directory contains the AWS CDK infrastructure code for the Fijian RAG App.

## Prerequisites

- Node.js 18+ installed
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Bootstrap CDK (first time only):
```bash
npx cdk bootstrap
```

## Commands

### Build
```bash
npm run build
```

### Synthesize CloudFormation template
```bash
npx cdk synth
```

### Deploy infrastructure
```bash
npx cdk deploy
```

### Destroy infrastructure
```bash
npx cdk destroy
```

### Run tests
```bash
npm test
```

## Stack Components

The `FijianRagAppStack` includes:

- **S3 Buckets**: Content storage and training data
- **DynamoDB Tables**: Learning modules, translations, and vocabulary
- **Lambda Functions**: Processing pipelines and API handlers
- **API Gateway**: RESTful API endpoints
- **OpenSearch**: Vector search capabilities
- **Cognito**: User authentication
- **Secrets Manager**: API key management

## Lambda Functions

All Lambda functions are located in the `../lambda/` directory and are automatically bundled by CDK during deployment.

## Environment Variables

The stack uses environment variables for configuration. Make sure to set appropriate values in your AWS environment or through CDK context.