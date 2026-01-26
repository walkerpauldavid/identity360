# IIS Deployment Guide for Identity360

This document describes how to deploy the Identity360 React application to IIS with ARR (Application Request Routing) reverse proxy for API calls.

## Prerequisites

### Required IIS Modules

1. **URL Rewrite Module**
   - Download: https://www.iis.net/downloads/microsoft/url-rewrite
   - Required for: Routing rules (SPA fallback, API proxy)

2. **Application Request Routing (ARR)**
   - Download: https://www.iis.net/downloads/microsoft/application-request-routing
   - Required for: Reverse proxy to Omada cloud API
   - **Important**: ARR must be enabled after installation

### Enabling ARR Proxy

After installing ARR, you must enable the proxy feature:

1. Open **IIS Manager**
2. Select the **server node** (not a site)
3. Double-click **Application Request Routing Cache**
4. Click **Server Proxy Settings** in the Actions pane
5. Check **Enable proxy**
6. Click **Apply**

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────┐
│                 │     │                 │     │                         │
│  Browser        │────▶│  IIS Server     │────▶│  Omada Cloud API        │
│                 │     │  (ARR Proxy)    │     │  pawa-poc2.omada.cloud  │
│                 │     │                 │     │                         │
└─────────────────┘     └─────────────────┘     └─────────────────────────┘

Requests:
- /api/*    → Proxied to https://pawa-poc2.omada.cloud/api/*
- /OData/*  → Proxied to https://pawa-poc2.omada.cloud/OData/*
- /*        → Served from IIS (React app)
```

## Configuration Files

### Environment Files

The application uses Vite environment files. **CRITICAL**: `VITE_OMADA_BASE_URL` must be empty in all environments.

#### `.env.production`
```env
# Production Environment (npm run build)
# IIS ARR proxy handles /api/* and /OData/* requests to https://pawa-poc2.omada.cloud
# Proxy rules defined in public/web.config

# Omada Base URL - MUST BE EMPTY (IIS ARR proxy in web.config)
VITE_OMADA_BASE_URL=

# OAuth2 Configuration (Azure AD)
VITE_TENANT_ID=your-tenant-id
VITE_CLIENT_ID=your-client-id
VITE_OAUTH2_SCOPE=api://your-app-id/.default

# Redirect URI - empty for dynamic origin detection
VITE_REDIRECT_URI=
```

#### `.env.development`
```env
# Development Environment (npm run dev)
# Vite proxy handles /api/* and /OData/* requests to https://pawa-poc2.omada.cloud

# Omada Base URL - MUST BE EMPTY (Vite proxy in vite.config.js)
VITE_OMADA_BASE_URL=

# OAuth2 Configuration (Azure AD)
VITE_TENANT_ID=your-tenant-id
VITE_CLIENT_ID=your-client-id
VITE_OAUTH2_SCOPE=api://your-app-id/.default

# Redirect URI - empty for dynamic origin detection
VITE_REDIRECT_URI=
```

### web.config (public/web.config)

This file MUST be in the `public/` folder so it gets copied to `dist/` during build.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- API Proxy Rule - MUST come before React Routes -->
        <rule name="Omada API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="https://pawa-poc2.omada.cloud/api/{R:1}" />
        </rule>

        <!-- OData Proxy Rule - MUST come before React Routes -->
        <rule name="Omada OData Proxy" stopProcessing="true">
          <match url="^OData/(.*)" />
          <action type="Rewrite" url="https://pawa-poc2.omada.cloud/OData/{R:1}" />
        </rule>

        <!-- React SPA Fallback - MUST come last -->
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>

    <!-- MIME types for modern web assets -->
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".woff" />
      <mimeMap fileExtension=".woff" mimeType="application/font-woff" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>

    <!-- Security headers -->
    <httpProtocol>
      <customHeaders>
        <add name="X-Content-Type-Options" value="nosniff" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

### Vite Config (vite.config.js)

For local development, Vite handles the proxy:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/OData': {
        target: 'https://pawa-poc2.omada.cloud',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://pawa-poc2.omada.cloud',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

## Deployment Process

### Build
```bash
npm run build
```

This creates a `dist/` folder containing:
- `index.html` - Main HTML file
- `assets/` - JavaScript, CSS, and images
- `web.config` - Copied from `public/web.config`

### Deploy to IIS

```powershell
# Copy all files from dist to IIS site folder
Copy-Item -Path "dist\*" -Destination "C:\inetpub\wwwroot\Identity360\" -Recurse -Force
```

### Verify Deployment

After deployment, verify the web.config has the proxy rules:
```powershell
Get-Content "C:\inetpub\wwwroot\Identity360\web.config"
```

Ensure it contains:
- `Omada API Proxy` rule
- `Omada OData Proxy` rule
- `React Routes` rule

## Mandatory Rules

1. **`VITE_OMADA_BASE_URL` must always be empty** - Both dev and prod use proxies
2. **`public/web.config` must contain both ARR proxy rules** - For `/api/*` and `/OData/*`
3. **Never deploy without verifying web.config** - Check proxy rules are present after deployment
4. **Rule order matters** - Proxy rules must come before the React Routes fallback

## Troubleshooting

### API calls return 404
- Check ARR is installed and proxy is enabled
- Verify web.config has the proxy rules
- Check rule order (proxy rules before React Routes)

### API calls return CORS errors
- This means ARR proxy is not working
- Verify ARR proxy is enabled at server level
- Check the rewrite rules are correct

### HTTP 500 - URL Rewrite Module Error
- URL Rewrite module may not be installed
- web.config syntax may be invalid
- Check IIS event logs for details

### OData calls fail but GraphQL works
- Ensure both `/api/*` AND `/OData/*` proxy rules exist
- OData uses `/OData/DataObjects/*` endpoint

### Identity details missing (email, title)
- Identity enrichment requires OData calls
- GraphQL does NOT support email, title, employeeId, department fields
- These must be fetched via OData and enriched client-side

## Azure AD Configuration

Ensure these redirect URIs are registered in Azure AD:
- `http://localhost:5173/callback` (Vite dev)
- `https://your-iis-server:port/callback` (IIS production)

## File Structure

```
project/
├── public/
│   └── web.config          # CRITICAL: Contains ARR proxy rules
├── src/
├── .env                    # Base config
├── .env.development        # Dev config (Vite proxy)
├── .env.production         # Prod config (IIS ARR proxy)
├── vite.config.js          # Dev proxy config
└── dist/                   # Build output (deployed to IIS)
    ├── index.html
    ├── assets/
    └── web.config          # Copied from public/
```
