# Fijian RAG App Development Instructions

**ALWAYS follow these instructions first and fallback to search or additional context gathering only when the information here is incomplete or found to be in error.**

The Fijian RAG App is a public-benefit AI project that brings Generative AI and language technologies to preserve and teach the Fijian language. This is a TypeScript/React/AWS CDK project with a multi-workspace structure.

## Working Effectively

### Bootstrap the Repository
Run these commands in order from the repository root:

```bash
# Install root dependencies - NEVER CANCEL: Takes 3 minutes
npm install
```

```bash  
# Install CDK dependencies - NEVER CANCEL: Takes 3 minutes
cd infrastructure/cdk && npm install
```

```bash
# Install frontend dependencies - NEVER CANCEL: Takes 3 minutes  
cd ../../frontend && npm install
```

```bash
# Return to root for builds
cd ..
```

### Build the Project
```bash
# Build everything - NEVER CANCEL: Takes 1-2 minutes. Set timeout to 5+ minutes.
npm run build
```

This command:
1. Runs lambda build (placeholder command)
2. Builds CDK infrastructure with Lambda bundling
3. Synthesizes CloudFormation templates

### Run Tests
```bash
# Run CDK infrastructure tests - NEVER CANCEL: Takes 25-30 seconds. Set timeout to 3+ minutes.
cd infrastructure/cdk && npm test
```

**CRITICAL**: Root-level `npm test` fails due to dependency sync issues. Always run tests in the `/infrastructure/cdk` directory instead.

### Run the Frontend Application  
```bash
# Start frontend development server - NEVER CANCEL: Takes 10-15 seconds to start
cd frontend && BROWSER=none npm start
```

The application will be available at `http://localhost:3000`. The build includes ESLint warnings but runs successfully in development mode.

## Prerequisites & Environment Setup

### Required Tools
- **Node.js 20.x** (verified working version)
- **AWS CLI** configured with appropriate credentials  
- **AWS CDK CLI** installed globally: `npm install -g aws-cdk`

### AWS Configuration
The project requires:
- AWS CLI configured with valid credentials
- CDK bootstrap (first time only): `npx cdk bootstrap`
- Access to AWS services: Lambda, API Gateway, DynamoDB, OpenSearch, S3, Cognito

## Common Tasks & Navigation

### Repository Structure
```
fijian-rag-app/
├── package.json              # Root workspace manager
├── frontend/                 # React application (Create React App)
│   ├── src/components/       # UI components
│   ├── src/services/         # API and service layers
│   └── src/hooks/           # Custom React hooks
├── backend/lambdas/          # AWS Lambda functions
│   ├── chat/                # Core RAG chat functionality  
│   ├── dictionary/          # Learning module processing
│   ├── rag/                 # RAG implementation
│   └── auth/                # Authentication handlers
├── infrastructure/cdk/       # AWS CDK infrastructure code
│   ├── lib/                 # CDK stack definitions
│   └── test/                # Infrastructure tests
└── scripts/                 # Utility scripts
```

### Key Files to Know
- **`package.json`** (root): Workspace scripts and dependencies
- **`infrastructure/cdk/lib/fijian-rag-app-stack.ts`**: Main CDK stack
- **`frontend/src/App.tsx`**: Main React application entry point
- **`backend/lambdas/chat/src/handler.ts`**: Chat API handler
- **`backend/lambdas/dictionary/index.ts`**: Dictionary processing handler

### Deploy Infrastructure
```bash
# Deploy to AWS - NEVER CANCEL: Takes 10-15 minutes. Set timeout to 25+ minutes.
npm run cdk:deploy
```

### Common Development Commands
```bash
# CDK synthesis (check CloudFormation templates)
cd infrastructure/cdk && npx cdk synth

# CDK destroy (cleanup AWS resources)  
cd infrastructure/cdk && npx cdk destroy

# Frontend tests only - NEVER CANCEL: Takes 5-10 seconds
cd frontend && npm test -- --passWithNoTests --watchAll=false

# View repository structure
ls -la                          # Root level
ls -la frontend/src/            # Frontend components
ls -la backend/lambdas/         # Lambda functions
ls -la infrastructure/cdk/lib/  # CDK stack definitions
```

## Critical Warnings & Timeouts

**NEVER CANCEL these operations:**
- `npm install` commands: 1-3 minutes each
- `npm run build`: 1-2 minutes  
- `npm test` (CDK): 25-30 seconds
- `npm run cdk:deploy`: 10-15 minutes
- `npm start` (frontend): 10-15 seconds

**Always set timeouts:**
- Build commands: 5+ minutes minimum
- Test commands: 3+ minutes minimum  
- Deploy commands: 25+ minutes minimum

## Validation & Testing

### Manual Validation Steps
After making changes, always run these validation steps:

1. **Build Validation**:
   ```bash
   npm run build
   ```
   Should complete without errors in 1-2 minutes.

2. **Infrastructure Test Validation**:
   ```bash
   cd infrastructure/cdk && npm test
   ```
   Should pass all 8+ tests in 25-30 seconds.

3. **Frontend Development Validation**:
   ```bash
   cd frontend && BROWSER=none npm start
   ```
   Should start development server with warnings (not errors) in 10-15 seconds.

4. **CDK Synthesis Validation**:
   ```bash
   cd infrastructure/cdk && npx cdk synth
   ```
   Should generate CloudFormation templates without errors.

### End-to-End Scenarios
When testing new features, run through these complete scenarios:

1. **Chat Functionality**: Start frontend, navigate to chat interface, verify UI loads
2. **Learning Modules**: Test translation exercises and vocabulary features  
3. **API Integration**: Verify frontend can call backend APIs (requires deployed infrastructure)

## Known Issues & Workarounds

### Frontend Build Issues
- **Problem**: `npm run build` in frontend fails due to ESLint warnings in CI mode
- **Workaround**: Use `npm start` for development. Production builds require fixing ESLint warnings.

### Root Test Issues  
- **Problem**: `npm test` from root fails due to dependency synchronization
- **Workaround**: Always run `npm test` from `/infrastructure/cdk` directory instead

### CDK Warnings
- **Expected**: Deprecation warnings about `logRetention` in Lambda functions
- **Action**: Ignore these warnings; they're non-breaking

## Environment Variables (AWS Deployment)
The following environment variables are configured automatically by CDK:
- `DICTIONARY_TABLE`
- `USER_PROGRESS_TABLE` 
- `OPENSEARCH_ENDPOINT`
- `OS_ENDPOINT`
- `OS_REGION`

## Architecture Notes

### AWS Services Used
- **Lambda**: Backend API functions (Node.js 20.x)
- **API Gateway**: RESTful API endpoints
- **DynamoDB**: Data storage (dictionary, user progress)
- **OpenSearch**: Vector search capabilities
- **S3**: Content storage
- **Cognito**: User authentication  
- **Secrets Manager**: API key management

### AI/ML Components
- **Claude 3 Haiku**: Via AWS Bedrock for chat and learning
- **Amazon Titan**: For embedding generation
- **RAG Pipeline**: Retrieval-Augmented Generation for Fijian language learning

## Complete Fresh Start Workflow

For a new developer or after cloning the repository:

```bash
# 1. Bootstrap all dependencies (5-10 minutes total)
npm install                          # 1-3 minutes
cd infrastructure/cdk && npm install  # 1-3 minutes  
cd ../../frontend && npm install     # 1-3 minutes
cd ..

# 2. Verify everything builds (1-2 minutes)
npm run build

# 3. Run tests to ensure everything works (25-30 seconds)
cd infrastructure/cdk && npm test
cd ../..

# 4. Start development server (10-15 seconds)
cd frontend && BROWSER=none npm start
```

After following this workflow:
- Infrastructure builds and tests pass
- Frontend runs at `http://localhost:3000` with ESLint warnings (expected)
- Ready for development

## Next Steps After Setup
1. Deploy infrastructure: `npm run cdk:deploy`
2. Upload dictionary content to S3
3. Test API endpoints with real data
4. Monitor OpenSearch indices and DynamoDB tables

Remember: This is a public-benefit project for Fijian language preservation. Always consider cultural sensitivity and linguistic accuracy in contributions.