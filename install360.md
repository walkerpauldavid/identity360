# Identity360 / Access Lens - IIS Deployment Guide

## Prerequisites

### Server Requirements
- Windows Server 2016 or later
- IIS 10.0 or later
- URL Rewrite Module 2.1 for IIS
- .NET Framework 4.8 (for URL Rewrite)

### Development/Build Requirements
- Node.js 18.x or later (LTS recommended)
- npm 9.x or later

---

## Installation Steps

### 1. Install IIS and Required Features

Open PowerShell as Administrator and run:

```powershell
# Install IIS with required features
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
Install-WindowsFeature -Name Web-Default-Doc
Install-WindowsFeature -Name Web-Static-Content
Install-WindowsFeature -Name Web-Http-Errors
Install-WindowsFeature -Name Web-Http-Redirect
Install-WindowsFeature -Name Web-Filtering
Install-WindowsFeature -Name Web-Stat-Compression
Install-WindowsFeature -Name Web-Dyn-Compression
```

### 2. Install URL Rewrite Module

Download and install the URL Rewrite Module from:
https://www.iis.net/downloads/microsoft/url-rewrite

This is required for React Router to work correctly with client-side routing.

### 3. Build the Application

Navigate to the project directory and run:

```bash
# Install dependencies
npm install

# Create production build
npm run build
```

This creates a `dist` folder containing the optimized production build.

### 4. Deploy to IIS

#### Option A: Manual Deployment

1. Copy the contents of the `dist` folder to your IIS web root:
   ```
   C:\inetpub\wwwroot\identity360\
   ```

2. Ensure the `web.config` file is present (see Configuration section below)

#### Option B: Scripted Deployment

```powershell
# Define paths
$sourcePath = ".\dist\*"
$targetPath = "C:\inetpub\wwwroot\identity360"

# Create target directory if it doesn't exist
if (!(Test-Path $targetPath)) {
    New-Item -ItemType Directory -Path $targetPath -Force
}

# Copy build files
Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force

Write-Host "Deployment complete to $targetPath"
```

### 5. Configure IIS Site

#### Create a New Site

```powershell
# Import IIS module
Import-Module WebAdministration

# Create application pool
New-WebAppPool -Name "Identity360Pool"
Set-ItemProperty "IIS:\AppPools\Identity360Pool" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty "IIS:\AppPools\Identity360Pool" -Name "enable32BitAppOnWin64" -Value $false

# Create website
New-Website -Name "Identity360" `
    -PhysicalPath "C:\inetpub\wwwroot\identity360" `
    -ApplicationPool "Identity360Pool" `
    -Port 443 `
    -Ssl
```

#### Or Add as Virtual Application

If adding to an existing site:

```powershell
New-WebApplication -Site "Default Web Site" `
    -Name "identity360" `
    -PhysicalPath "C:\inetpub\wwwroot\identity360" `
    -ApplicationPool "Identity360Pool"
```

---

## Configuration

### web.config

Create or update `web.config` in the deployment root (`C:\inetpub\wwwroot\identity360\`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
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
        <staticContent>
            <remove fileExtension=".js" />
            <mimeMap fileExtension=".js" mimeType="application/javascript" />
            <remove fileExtension=".json" />
            <mimeMap fileExtension=".json" mimeType="application/json" />
            <remove fileExtension=".woff" />
            <mimeMap fileExtension=".woff" mimeType="font/woff" />
            <remove fileExtension=".woff2" />
            <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
        </staticContent>
        <httpProtocol>
            <customHeaders>
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-Frame-Options" value="SAMEORIGIN" />
                <add name="X-XSS-Protection" value="1; mode=block" />
            </customHeaders>
        </httpProtocol>
        <httpCompression>
            <dynamicTypes>
                <add mimeType="application/javascript" enabled="true" />
                <add mimeType="application/json" enabled="true" />
            </dynamicTypes>
            <staticTypes>
                <add mimeType="application/javascript" enabled="true" />
                <add mimeType="text/css" enabled="true" />
            </staticTypes>
        </httpCompression>
    </system.webServer>
</configuration>
```

### Environment Configuration

The application reads configuration from environment-specific settings. Update the following in your build or deployment:

1. **API Base URL**: Configure in `src/config/` or via environment variables
2. **Authentication**: Ensure CORS is configured on the Omada API server
3. **Bearer Token Handling**: The app uses Windows authentication passthrough

---

## SSL/TLS Configuration

### Using a Self-Signed Certificate (Development/Testing)

```powershell
# Create self-signed certificate
$cert = New-SelfSignedCertificate -DnsName "identity360.yourdomain.com" `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddYears(2)

# Bind to IIS site
New-WebBinding -Name "Identity360" -Protocol "https" -Port 443
$binding = Get-WebBinding -Name "Identity360" -Protocol "https"
$binding.AddSslCertificate($cert.Thumbprint, "My")
```

### Using a Production Certificate

1. Obtain a certificate from your Certificate Authority
2. Import to Windows Certificate Store (Local Machine > Personal)
3. Bind to the IIS site via IIS Manager or PowerShell

---

## Permissions

Set appropriate permissions on the deployment folder:

```powershell
$path = "C:\inetpub\wwwroot\identity360"
$acl = Get-Acl $path

# Grant IIS_IUSRS read access
$permission = "IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($rule)

# Grant Application Pool identity read access
$appPoolIdentity = "IIS AppPool\Identity360Pool"
$permission = $appPoolIdentity, "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($rule)

Set-Acl $path $acl
```

---

## Verification

### 1. Check IIS Site Status

```powershell
Get-Website -Name "Identity360"
```

### 2. Test URL Rewrite

Navigate to a deep route like `/access-lens/12345` - it should load the app (not return 404).

### 3. Check Browser Console

Open Developer Tools (F12) and verify:
- No JavaScript errors
- API calls returning successfully
- Assets loading correctly

### 4. Test Authentication

Verify Windows Authentication passthrough is working by checking API responses.

---

## Troubleshooting

### 404 Errors on Routes

**Cause**: URL Rewrite not configured or module not installed

**Solution**:
1. Verify URL Rewrite Module is installed
2. Check `web.config` has the rewrite rules
3. Restart IIS: `iisreset`

### CORS Errors

**Cause**: API server not configured for cross-origin requests

**Solution**: Configure CORS on the Omada API server to allow requests from your Identity360 domain

### Blank Page

**Cause**: Base path mismatch or JavaScript errors

**Solution**:
1. Check browser console for errors
2. Verify `base` in `vite.config.js` matches deployment path
3. Rebuild with correct base path: `npm run build -- --base=/identity360/`

### Authentication Failures

**Cause**: Bearer token not being passed correctly

**Solution**:
1. Verify Windows Authentication is enabled on IIS
2. Check API endpoint configuration
3. Verify network allows authentication headers

---

## Updates and Redeployment

To update the application:

```powershell
# Stop the application pool
Stop-WebAppPool -Name "Identity360Pool"

# Deploy new files
Copy-Item -Path ".\dist\*" -Destination "C:\inetpub\wwwroot\identity360" -Recurse -Force

# Start the application pool
Start-WebAppPool -Name "Identity360Pool"
```

---

## Rollback Procedure

Keep previous versions for rollback:

```powershell
# Before deploying, backup current version
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "C:\inetpub\backups\identity360-$timestamp"
Copy-Item -Path "C:\inetpub\wwwroot\identity360" -Destination $backupPath -Recurse

# To rollback
Stop-WebAppPool -Name "Identity360Pool"
Remove-Item -Path "C:\inetpub\wwwroot\identity360\*" -Recurse -Force
Copy-Item -Path "$backupPath\*" -Destination "C:\inetpub\wwwroot\identity360" -Recurse
Start-WebAppPool -Name "Identity360Pool"
```

---

## Related Documentation

- [Access Lens Requirements](src/components/access-lens/AccessLens.md)
- [User Stories](UserStories.md)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [IIS URL Rewrite](https://docs.microsoft.com/en-us/iis/extensions/url-rewrite-module/url-rewrite-module-configuration-reference)
