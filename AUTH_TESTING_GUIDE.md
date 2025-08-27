# Authentication Flow Validation Guide

This guide provides manual testing procedures to validate the Cognito login flows after the domain fix.

## Issue Summary

**Problem**: Login flow was redirecting to the wrong domain
- ❌ **Before**: `https://fijian-auth.auth.us-west-2.amazoncognito.com/login` (unstyled AWS domain)
- ✅ **After**: `https://auth.fijian-ai.org/login` (custom domain with proper styling)

## Manual Test Procedures

### 1. Basic Login Flow Test

1. **Start the application**:
   ```bash
   cd frontend
   BROWSER=none npm start
   ```

2. **Open browser** to `http://localhost:3000`

3. **Click "Sign In" button**

4. **Check console logs** for the following:
   ```
   🔐 Cognito Login Flow - Redirecting to: https://auth.fijian-ai.org/login?client_id=4pvrvr5jf8h9bvi59asmlbdjcp...
   🔧 Using domain: auth.fijian-ai.org
   🔧 Using client ID: 4pvrvr5jf8h9bvi59asmlbdjcp
   ```

5. **Verify redirect URL** contains `auth.fijian-ai.org` and NOT `fijian-auth.auth.us-west-2.amazoncognito.com`

### 2. Configuration Validation Test

1. **Open browser developer console**

2. **Run validation command**:
   ```javascript
   // Import and run the validation utility
   import('./utils/authTestUtils').then(utils => {
     utils.validateCognitoConfig();
   });
   ```

3. **Expected console output**:
   ```
   🔍 Cognito Configuration Validation
   🏢 Region: us-west-2
   🔑 User Pool ID: us-west-2_shE3zxrwp
   📱 Client ID: 4pvrvr5jf8h9bvi59asmlbdjcp
   🌐 Domain: auth.fijian-ai.org
   🔗 Generated URLs
   📥 Sign In URL: https://auth.fijian-ai.org/login?...
   📤 Sign Out URL: https://auth.fijian-ai.org/logout?...
   ✅ Domain Validation: PASS - Using custom domain
   ```

### 3. Token Exchange Flow Test

When redirected back from Cognito (in production):

1. **Check URL parameters** after redirect:
   - Should contain `?code=XXXXXX` parameter
   - URL should be clean (no hash fragments)

2. **Check console logs** for token exchange:
   ```
   🔍 Parsing tokens from URL: https://fijian-ai.org/?code=XXXXXX
   🔍 Authorization code found: Yes
   🔍 Error in URL: None
   🔄 Exchanging authorization code for tokens...
   ✅ Tokens received successfully
   🎫 ID Token length: XXXX
   🎟️ Access Token length: XXXX
   ```

3. **Verify localStorage** contains tokens:
   ```javascript
   console.log('ID Token:', localStorage.getItem('cognitoIdToken') ? 'Present' : 'Missing');
   console.log('Access Token:', localStorage.getItem('cognitoAccessToken') ? 'Present' : 'Missing');
   ```

### 4. Environment Variable Override Test

1. **Create `.env.local` file** in frontend directory:
   ```env
   REACT_APP_COGNITO_DOMAIN=test.example.com
   REACT_APP_COGNITO_CLIENT_ID=test-client-id
   ```

2. **Restart the application**

3. **Check configuration** uses override values:
   ```javascript
   import('./config/cognito').then(config => {
     console.log('Domain:', config.COGNITO_CONFIG.domain);
     console.log('Client ID:', config.COGNITO_CONFIG.clientId);
   });
   ```

4. **Remove `.env.local`** and restart to restore defaults

### 5. Error Handling Test

Simulate an error response from Cognito:

1. **Manually navigate** to a URL with error parameter:
   ```
   http://localhost:3000/?error=access_denied&error_description=User+cancelled
   ```

2. **Check console logs** for error handling:
   ```
   🔍 Parsing tokens from URL: http://localhost:3000/?error=access_denied...
   🔍 Authorization code found: No
   🔍 Error in URL: access_denied
   ❌ Cognito authentication error: access_denied
   ```

## Automated Tests

Run the comprehensive test suite:

```bash
# Run all frontend tests
npm test -- --passWithNoTests --watchAll=false

# Run specific auth tests
npm test -- --testPathPattern=authTestUtils --passWithNoTests --watchAll=false
```

**Expected results**:
- ✅ All tests should pass
- ✅ Console logs should show domain validation: "PASS - Using custom domain"
- ✅ Generated URLs should use `auth.fijian-ai.org`

## Production Validation Checklist

When testing on production/staging:

- [ ] Login redirects to `https://auth.fijian-ai.org/login`
- [ ] Login page has proper Fijian AI styling (not default AWS styling)
- [ ] Authorization code flow completes successfully
- [ ] ID and Access tokens are stored in localStorage
- [ ] User session persists across page refreshes
- [ ] Logout redirects to `https://auth.fijian-ai.org/logout`
- [ ] Console logs show successful token exchange

## Troubleshooting

### Common Issues

1. **Still redirecting to AWS domain**:
   - Check environment variables
   - Clear browser cache and localStorage
   - Verify the latest code is deployed

2. **ERR_BLOCKED_BY_CLIENT**:
   - Normal in development/testing environments
   - Domain blocking doesn't affect the fix validation
   - Check console logs to verify correct domain is being used

3. **Token exchange failures**:
   - Verify custom domain is properly configured in AWS Console
   - Check Cognito User Pool Client configuration
   - Ensure redirect URIs match exactly

### Debug Commands

```javascript
// Check current configuration
import('./utils/authTestUtils').then(utils => {
  utils.validateCognitoConfig();
  utils.validateEnvironmentVariables();
});

// Simulate token parsing
import('./utils/authTestUtils').then(utils => {
  utils.simulateTokenRedirect('https://fijian-ai.org/?code=test123');
});
```

## Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `REACT_APP_COGNITO_DOMAIN` | `auth.fijian-ai.org` | Custom Cognito domain |
| `REACT_APP_COGNITO_CLIENT_ID` | `4pvrvr5jf8h9bvi59asmlbdjcp` | Cognito client ID |
| `REACT_APP_REDIRECT_URI` | `window.location.origin` (dev) / `https://fijian-ai.org` (prod) | OAuth redirect URI |

## Success Criteria

✅ **Fix is successful when**:
1. Login redirects to `auth.fijian-ai.org` instead of AWS domain
2. Console logs show correct domain usage
3. All automated tests pass
4. Login page displays proper styling (when accessible)
5. Token exchange completes successfully (in production)