# Deployment Workflows

This repository uses separate GitHub Actions workflows for frontend and backend deployments to ensure reliable and efficient deployments.

## Workflows

### Frontend Deployment (`frontend-deploy.yml`)
**Triggers:**
- Push to `main` branch with changes in:
  - `frontend/` directory
  - `scripts/deploy-frontend.js`
  - `scripts/configure-frontend.js`
- Manual dispatch via GitHub Actions UI

**What it does:**
1. Installs dependencies
2. Runs `npm run frontend:deploy` which:
   - Gets CDK outputs for API configuration
   - Generates frontend `.env` file
   - Builds the React application
   - Uploads to S3 bucket
   - Sets cache headers

### Backend Deployment (`backend-deploy.yml`)
**Triggers:**
- Push to `main` branch with changes in:
  - `infrastructure/` directory (CDK code)
  - `backend/` directory (Lambda functions)
  - `lambda/` directory 
  - `schemas/` directory
  - `scripts/` directory (except frontend-specific scripts)
  - Root `package.json` or `package-lock.json`
- Manual dispatch via GitHub Actions UI

**What it does:**
1. Installs dependencies
2. Builds the project (`npm run build`)
3. Runs tests (`npm test`)
4. Synthesizes CDK templates
5. Deploys infrastructure (`npm run cdk:deploy`)

## Benefits of Separation

1. **Reliable Triggering**: Uses GitHub's native `paths` filtering instead of unreliable runtime commit inspection
2. **Independent Execution**: Both workflows can run simultaneously if both areas change
3. **Faster Deployments**: Only affected components are deployed
4. **Better Debugging**: Clear separation makes it easier to debug deployment issues
5. **Selective Deployment**: Can manually trigger just frontend or backend deployment

## Migration from Previous Setup

Previously, a single `deploy.yml` file used conditional logic that was unreliable:
- `if: contains(github.event.head_commit.modified, 'frontend/')` 
- `if: "!contains(github.event.head_commit.modified, 'frontend/')"`

This approach had issues:
- `github.event.head_commit.modified` is not always reliable
- Mutually exclusive logic prevented both deployments when both areas changed
- Runtime inspection is less reliable than build-time path filtering

The new approach uses GitHub's built-in `paths` filtering which is more reliable and flexible.