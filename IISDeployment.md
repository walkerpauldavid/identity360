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

## IIS Site Setup (PowerShell)

### Prerequisites

The IIS PowerShell module (`WebAdministration`) is available on any Windows Server with the IIS role installed. Run all commands in an **elevated PowerShell** session.

```powershell
# Verify IIS management module is available
Import-Module WebAdministration
```

### Step 1: Create the Application Pool

Identity360 is a static SPA — it doesn't need .NET CLR. Use an unmanaged (No Managed Code) application pool for best performance.

```powershell
# Create a dedicated application pool
New-WebAppPool -Name "Identity360AppPool"

# Configure: No Managed Code (static site), Integrated pipeline
Set-ItemProperty "IIS:\AppPools\Identity360AppPool" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty "IIS:\AppPools\Identity360AppPool" -Name "managedPipelineMode" -Value "Integrated"

# Set identity to NetworkService (or use a specific service account)
Set-ItemProperty "IIS:\AppPools\Identity360AppPool" -Name "processModel.identityType" -Value "NetworkService"

# Optional: Configure recycling (default is every 29 hours)
Set-ItemProperty "IIS:\AppPools\Identity360AppPool" -Name "recycling.periodicRestart.time" -Value "00:00:00"  # Disable time-based recycling
```

### Step 2: Create the Physical Directory

```powershell
# Create the site root directory
New-Item -Path "C:\inetpub\wwwroot\Identity360" -ItemType Directory -Force

# Set permissions — the app pool identity needs read access
$acl = Get-Acl "C:\inetpub\wwwroot\Identity360"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "NETWORK SERVICE", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl "C:\inetpub\wwwroot\Identity360" $acl
```

### Step 3: Create the IIS Website

**Option A: Standalone Website** (separate port or hostname binding)

```powershell
# Create as a standalone website on port 443 with a specific hostname
New-Website -Name "Identity360" `
    -PhysicalPath "C:\inetpub\wwwroot\Identity360" `
    -ApplicationPool "Identity360AppPool" `
    -Port 443 `
    -HostHeader "identity360.yourdomain.com" `
    -Ssl

# Or create on a custom port without hostname binding (for testing)
New-Website -Name "Identity360" `
    -PhysicalPath "C:\inetpub\wwwroot\Identity360" `
    -ApplicationPool "Identity360AppPool" `
    -Port 8443
```

**Option B: Application under Default Web Site** (shared port 443)

```powershell
# Create as an application under the Default Web Site
New-WebApplication -Site "Default Web Site" `
    -Name "Identity360" `
    -PhysicalPath "C:\inetpub\wwwroot\Identity360" `
    -ApplicationPool "Identity360AppPool"

# Note: This serves the app at https://server/Identity360/
# You may need to adjust the Vite base path in vite.config.js:
#   base: '/Identity360/'
```

### Step 4: Bind an SSL Certificate

```powershell
# List available certificates in the local machine store
Get-ChildItem Cert:\LocalMachine\My | Format-Table Subject, Thumbprint, NotAfter

# Bind a certificate to the site (replace thumbprint)
$thumbprint = "YOUR_CERTIFICATE_THUMBPRINT"
New-WebBinding -Name "Identity360" -Protocol "https" -Port 443 -HostHeader "identity360.yourdomain.com"

# Assign the certificate to the binding
$binding = Get-WebBinding -Name "Identity360" -Protocol "https"
$binding.AddSslCertificate($thumbprint, "My")
```

### Step 5: Install Required IIS Modules

```powershell
# Install URL Rewrite and ARR via WebPI (Web Platform Installer) if available
# Otherwise download and install manually from:
#   URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite
#   ARR:         https://www.iis.net/downloads/microsoft/application-request-routing

# After installing ARR, enable the proxy at server level
Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" `
    -Filter "system.webServer/proxy" `
    -Name "enabled" `
    -Value "True"
```

### Step 6: Verify the Site Configuration

```powershell
# Check the site exists and is running
Get-Website -Name "Identity360" | Format-Table Name, State, PhysicalPath, Bindings

# Check the app pool is running
Get-WebAppPoolState -Name "Identity360AppPool"

# Start the site if it's stopped
Start-Website -Name "Identity360"

# Verify ARR proxy is enabled
Get-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" `
    -Filter "system.webServer/proxy" `
    -Name "enabled"
```

### Complete Setup Script

Copy and run as a single script for a fresh server:

```powershell
#Requires -RunAsAdministrator
Import-Module WebAdministration

$siteName       = "Identity360"
$appPoolName    = "Identity360AppPool"
$physicalPath   = "C:\inetpub\wwwroot\Identity360"
$port           = 443
$hostHeader     = "identity360.yourdomain.com"  # Change to your hostname

# 1. Create directory
New-Item -Path $physicalPath -ItemType Directory -Force

# 2. Create app pool (No Managed Code — static SPA)
New-WebAppPool -Name $appPoolName
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name "managedPipelineMode" -Value "Integrated"
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name "processModel.identityType" -Value "NetworkService"

# 3. Set directory permissions
$acl = Get-Acl $physicalPath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "NETWORK SERVICE", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl $physicalPath $acl

# 4. Create website
New-Website -Name $siteName `
    -PhysicalPath $physicalPath `
    -ApplicationPool $appPoolName `
    -Port $port `
    -HostHeader $hostHeader

# 5. Enable ARR proxy (server-level)
Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" `
    -Filter "system.webServer/proxy" `
    -Name "enabled" `
    -Value "True"

# 6. Verify
Write-Host "`n=== Site Created ===" -ForegroundColor Green
Get-Website -Name $siteName | Format-Table Name, State, PhysicalPath
Get-WebAppPoolState -Name $appPoolName
Write-Host "ARR Proxy Enabled:" (Get-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/proxy" -Name "enabled").Value
Write-Host "`nNext: Build the app (npm run build) and deploy to $physicalPath"
```

---

## Deployment Process

### Build
```bash
npm run build
```

This creates a `dist/` folder containing:
- `index.html` - Main HTML file (references hashed asset filenames)
- `assets/` - JavaScript, CSS, and images (hashed filenames per build)
- `web.config` - Copied from `public/web.config`

### Deploy to IIS

**Important**: Always copy both `index.html` AND `assets/`. Vite produces hashed filenames on each build, so `index.html` must be updated to reference the new bundles. Copying only `assets/` leaves the old `index.html` pointing at stale JS files.

```powershell
# Deploy: copy everything from dist to the IIS site
Copy-Item -Path "dist\*" -Destination "C:\inetpub\wwwroot\Identity360\" -Recurse -Force

# Verify the deployment
Get-ChildItem "C:\inetpub\wwwroot\Identity360\" | Format-Table Name, LastWriteTime
```

### Verify Deployment

```powershell
# Check web.config has the proxy rules
Select-String -Path "C:\inetpub\wwwroot\Identity360\web.config" -Pattern "Omada API Proxy|Omada OData Proxy|React Routes"

# Check index.html references current asset hashes
Get-Content "C:\inetpub\wwwroot\Identity360\index.html"
```

Ensure web.config contains:
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
