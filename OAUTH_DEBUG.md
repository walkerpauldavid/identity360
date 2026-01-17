# OAuth Login Debug Guide

## Step-by-Step Debugging

### 1. Open Browser Console
- Press F12 to open Developer Tools
- Go to the **Console** tab
- Keep it open

### 2. Click "Sign in with Microsoft"

You should see logs like this:

```
=== Login button clicked ===
Attempting to initiate OAuth flow...
=== Starting OAuth2 Login Flow ===
Checking OAuth configuration...
Tenant ID: SET
Client ID: SET
Redirect URI: http://localhost:5173/callback
Scope: https://graph.microsoft.com/.default offline_access
Generating PKCE parameters...
PKCE parameters generated successfully
Stored state and code verifier to localStorage
=== Redirecting to Microsoft Login ===
Authorization URL: https://login.microsoftonline.com/...
```

### 3. Common Issues and Fixes

#### Issue: "Tenant ID: MISSING" or "Client ID: MISSING"

**Fix:**
1. Create or edit `.env` file in project root:
```env
VITE_TENANT_ID=your-tenant-id-here
VITE_CLIENT_ID=your-client-id-here
VITE_OAUTH2_SCOPE=https://graph.microsoft.com/.default
VITE_REDIRECT_URI=http://localhost:5173/callback
```

2. **IMPORTANT:** Restart the dev server:
```bash
# Press Ctrl+C to stop
npm run dev
```

3. Hard refresh the browser (Ctrl+Shift+R or Ctrl+F5)

#### Issue: "Missing OAuth configuration" alert

**Fix:** Same as above - check your `.env` file has VITE_TENANT_ID and VITE_CLIENT_ID

#### Issue: No redirect happens, no error

**Possible causes:**
1. **Browser popup blocker** - Check if browser blocked the redirect
2. **JavaScript error** - Check Console for red errors
3. **window.location.href not working** - Try this test:

In the Console, type:
```javascript
window.location.href = 'https://www.google.com'
```

If Google doesn't load, your browser security is blocking navigation.

#### Issue: Console shows the Authorization URL but no redirect

**Test manually:**
1. Copy the Authorization URL from the console (starts with `https://login.microsoftonline.com/...`)
2. Paste it into a new browser tab
3. If Microsoft login appears, the URL is correct but JavaScript redirect is blocked

### 4. Get Your Azure Configuration

If you don't have your Tenant ID and Client ID:

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app or create a new one
4. Copy these values:
   - **Directory (tenant) ID** → VITE_TENANT_ID
   - **Application (client) ID** → VITE_CLIENT_ID
5. Under **Authentication**, add redirect URI: `http://localhost:5173/callback`

### 5. Quick Test Script

Open browser console and paste this to test configuration:

```javascript
const config = {
  tenantId: import.meta.env.VITE_TENANT_ID,
  clientId: import.meta.env.VITE_CLIENT_ID
};
console.log('Tenant ID:', config.tenantId || 'MISSING');
console.log('Client ID:', config.clientId || 'MISSING');
```

### 6. Still Not Working?

Share these details:
1. Full console output when clicking login
2. Network tab screenshot (F12 → Network)
3. Any error alerts that appear
4. Your `.env` file contents (HIDE the actual IDs, just show structure)
