/**
 * API Logger Service
 * Logs all OData and GraphQL API calls and responses
 *
 * Uses window.__apiLogger to ensure singleton across module boundaries
 */

class ApiLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100; // Keep last 100 log entries (reduced to save space)
    this.backendUrl = 'http://localhost:3001/api/log';
    this.sendToBackend = true; // Set to false to disable backend logging
    this.instanceId = Math.random().toString(36).substr(2, 9);
    console.log(`[ApiLogger] Instance created with ID: ${this.instanceId}, logs: ${this.logs.length}`);
  }

  /**
   * Send log entry to backend server
   */
  async sendLogToBackend(logEntry) {
    if (!this.sendToBackend) return;

    try {
      await fetch(this.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      // Silently fail if backend is not available
      console.warn('Failed to send log to backend:', error.message);
    }
  }

  /**
   * Log an API request
   */
  logRequest(type, endpoint, params = {}, requestHeaders = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'REQUEST',
      apiType: type, // 'OData' or 'GraphQL'
      endpoint,
      params,
      requestHeaders,
      requestId: this.generateRequestId()
    };

    this.logs.push(logEntry);
    this.trimLogs();
    this.sendLogToBackend(logEntry);

    // Debug: Bright colored console log to verify logging is working
    console.log(`%c[API ${type} REQUEST] ${endpoint}`, 'background: #0066cc; color: white; padding: 2px 6px; border-radius: 3px;');
    console.log(`%c[ApiLogger ${this.instanceId}] Added REQUEST, total logs: ${this.logs.length}`, 'color: #0066cc;');

    return logEntry.requestId;
  }

  /**
   * Log an API response
   */
  logResponse(requestId, type, endpoint, response, success = true, error = null, responseHeaders = {}, statusCode = null, rawResponse = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'RESPONSE',
      apiType: type,
      endpoint,
      requestId,
      success,
      response: success ? response : null,
      rawResponse: rawResponse, // Store raw response as received from API
      error: error ? error.message : null,
      status: success ? 'SUCCESS' : 'ERROR',
      responseHeaders,
      statusCode
    };

    this.logs.push(logEntry);
    this.trimLogs();
    this.sendLogToBackend(logEntry);

    // Debug: Bright colored console log to verify logging is working
    if (success) {
      console.log(`%c[API ${type} RESPONSE] ${endpoint} - Status: ${statusCode}`, 'background: #28a745; color: white; padding: 2px 6px; border-radius: 3px;');
    } else {
      console.log(`%c[API ${type} ERROR] ${endpoint} - Status: ${statusCode}`, 'background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px;');
      console.error('Error:', error);
    }
    console.log(`%c[ApiLogger ${this.instanceId}] Added RESPONSE, total logs: ${this.logs.length}`, 'color: #28a745;');
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Keep only the last N log entries
   */
  trimLogs() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Get all logs
   * Returns a new array reference to ensure React detects changes
   */
  getLogs() {
    console.log(`[ApiLogger ${this.instanceId}] getLogs called, returning ${this.logs.length} logs`);
    return [...this.logs];  // Return new array to trigger React re-render
  }

  /**
   * Get logs as formatted text
   */
  getLogsAsText() {
    return this.logs.map(log => {
      const header = `${log.type} - ${log.apiType}`;
      if (log.type === 'REQUEST') {
        const headersText = log.requestHeaders ? `\nRequest Headers:\n${JSON.stringify(log.requestHeaders, null, 2)}` : '';
        return `${header}\nEndpoint: ${log.endpoint}\nRequest ID: ${log.requestId}${headersText}\nParams: ${JSON.stringify(log.params, null, 2)}\n${'='.repeat(80)}`;
      } else {
        const status = log.success ? 'SUCCESS' : 'ERROR';
        const statusCodeText = log.statusCode ? `\nStatus Code: ${log.statusCode}` : '';
        const headersText = log.responseHeaders ? `\nResponse Headers:\n${JSON.stringify(log.responseHeaders, null, 2)}` : '';
        const body = log.success
          ? `Response: ${JSON.stringify(log.response, null, 2)}`
          : `Error: ${log.error}`;
        return `${header}\nEndpoint: ${log.endpoint}\nRequest ID: ${log.requestId}\nStatus: ${status}${statusCodeText}${headersText}\n${body}\n${'='.repeat(80)}`;
      }
    }).join('\n\n');
  }

  /**
   * Download logs as a file
   */
  downloadLogs() {
    const logText = this.getLogsAsText();
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const filename = 'omada-api-log.txt';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`Logs downloaded as: ${filename}`);
    return filename;
  }

  /**
   * Generate Windows cURL command for a request
   */
  generateCurlCommand(requestLog) {
    if (!requestLog || requestLog.type !== 'REQUEST') {
      return 'No request data available';
    }

    const { endpoint, requestHeaders, params, apiType } = requestLog;

    // Build full URL with hostname for cURL example
    const omadaHostname = 'https://pawa-poc2.omada.cloud';
    const fullUrl = endpoint.startsWith('/') ? `${omadaHostname}${endpoint}` : endpoint;

    // Determine HTTP method
    const method = apiType === 'GraphQL' ? 'POST' : (params?.method || 'GET');

    // Build cURL command with line continuations for readability
    let curlLines = [];
    curlLines.push(`curl -X ${method} "${fullUrl}"`);

    // Add headers
    if (requestHeaders) {
      Object.entries(requestHeaders).forEach(([key, value]) => {
        // Skip Content-Type for GraphQL as we'll add it explicitly
        if (key.toLowerCase() === 'content-type' && apiType === 'GraphQL') return;
        curlLines.push(`  -H "${key}: ${String(value)}"`);
      });
    }

    // Add Content-Type for GraphQL
    if (apiType === 'GraphQL') {
      curlLines.push(`  -H "Content-Type: application/json"`);
    }

    // Add request body for GraphQL (POST requests)
    if (apiType === 'GraphQL' && params?.graphqlQuery) {
      // Normalize the GraphQL query - remove excess whitespace for cleaner cURL
      const normalizedQuery = params.graphqlQuery
        .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
        .trim();

      const graphqlBody = {
        query: normalizedQuery,
        variables: params.variables || {}  // Always include variables
      };

      // For Windows cmd.exe: we need to escape the JSON for the command line
      // JSON.stringify produces: {"query":"...","variables":{}}
      //
      // IMPORTANT: JSON.stringify already escapes internal quotes as \"
      // For example, a query with array ["id"] becomes: {"query":"... [\"id\"] ..."}
      //
      // For Windows cmd.exe -d argument:
      // - We wrap the entire JSON in double quotes
      // - We need to escape the JSON's double quotes with backslash
      // - But we must NOT double-escape the already-escaped quotes from JSON.stringify
      //
      // Solution: First, temporarily replace \" with a placeholder, then escape ", then restore
      const bodyJson = JSON.stringify(graphqlBody);

      // Step 1: Replace already-escaped quotes \" with placeholder
      const placeholder = '\x00ESCAPED_QUOTE\x00';
      let escaped = bodyJson.replace(/\\"/g, placeholder);

      // Step 2: Escape remaining (unescaped) double quotes
      escaped = escaped.replace(/"/g, '\\"');

      // Step 3: Restore the originally-escaped quotes (they become \\\")
      // In cmd.exe: \\\" = literal backslash + literal quote
      escaped = escaped.replace(new RegExp(placeholder, 'g'), '\\\\\\"');

      curlLines.push(`  -d "${escaped}"`);
    } else if (apiType === 'GraphQL') {
      // Debug: GraphQL but no query found
      console.warn('generateCurlCommand: GraphQL request but no graphqlQuery in params', params);
      curlLines.push(`  -d "{\\"query\\": \\"ERROR: No GraphQL query found in params\\"}"`);
    }

    // Join with Windows line continuation
    const curlCommand = curlLines.join(' ^\n');

    // Add comment with function name
    let comment = `REM Function: ${params?.functionName || 'N/A'}\n`;
    comment += `REM Endpoint: ${fullUrl}\n\n`;

    // Also generate a PowerShell version
    let psCommand = this.generatePowerShellCommand(requestLog, fullUrl);

    return comment + 'REM Windows cmd.exe cURL command:\n' + curlCommand + '\n\n\nREM PowerShell alternative:\n' + psCommand;
  }

  /**
   * Generate PowerShell Invoke-RestMethod command for a request
   */
  generatePowerShellCommand(requestLog, fullUrl) {
    const { requestHeaders, params, apiType } = requestLog;

    const method = apiType === 'GraphQL' ? 'POST' : (params?.method || 'GET');

    // Build headers hashtable
    let headersObj = {};
    if (requestHeaders) {
      Object.entries(requestHeaders).forEach(([key, value]) => {
        // Skip Content-Type for GraphQL as we'll set it in the command
        if (key.toLowerCase() === 'content-type' && apiType === 'GraphQL') return;
        headersObj[key] = String(value);
      });
    }

    let psCommand = `$headers = @{\n`;
    Object.entries(headersObj).forEach(([key, value]) => {
      // Escape single quotes in PowerShell by doubling them
      const escapedValue = value.replace(/'/g, "''");
      psCommand += `  '${key}' = '${escapedValue}'\n`;
    });
    psCommand += `}\n\n`;

    if (apiType === 'GraphQL' && params?.graphqlQuery) {
      const graphqlBody = {
        query: params.graphqlQuery
      };
      if (params.variables && Object.keys(params.variables).length > 0) {
        graphqlBody.variables = params.variables;
      }

      // Use here-string for the body to avoid escaping issues
      const bodyJson = JSON.stringify(graphqlBody, null, 2);
      psCommand += `$body = @'\n${bodyJson}\n'@\n\n`;
      psCommand += `$response = Invoke-RestMethod -Uri '${fullUrl}' -Method ${method} -Headers $headers -Body $body -ContentType 'application/json'\n`;
      psCommand += `$response | ConvertTo-Json -Depth 10`;
    } else {
      psCommand += `$response = Invoke-RestMethod -Uri '${fullUrl}' -Method ${method} -Headers $headers\n`;
      psCommand += `$response | ConvertTo-Json -Depth 10`;
    }

    return psCommand;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    console.log('API logs cleared');
  }

  /**
   * Auto-save logs to localStorage periodically
   */
  saveToLocalStorage() {
    try {
      // Only save the most recent logs to avoid quota issues
      const logsToSave = this.logs.slice(-50); // Only save last 50 logs
      localStorage.setItem('omada_api_logs', JSON.stringify(logsToSave));
      console.log(`Logs saved to localStorage (${logsToSave.length} entries)`);
    } catch (error) {
      console.error('Failed to save logs to localStorage:', error);
      // If quota exceeded, clear old logs and try again
      if (error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, clearing old logs...');
        try {
          localStorage.removeItem('omada_api_logs');
          const minimalLogs = this.logs.slice(-20); // Save even fewer logs
          localStorage.setItem('omada_api_logs', JSON.stringify(minimalLogs));
          console.log('Saved minimal logs after quota error');
        } catch (retryError) {
          console.error('Failed to save even minimal logs:', retryError);
        }
      }
    }
  }

  /**
   * Load logs from localStorage
   */
  loadFromLocalStorage() {
    try {
      const savedLogs = localStorage.getItem('omada_api_logs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
        console.log(`Loaded ${this.logs.length} logs from localStorage`);
      }
    } catch (error) {
      console.error('Failed to load logs from localStorage:', error);
    }
  }
}

// Use window-based singleton to ensure same instance across all module boundaries
// This prevents issues with bundlers creating multiple instances
let apiLoggerInstance;

if (typeof window !== 'undefined') {
  // Check if instance already exists on window
  if (!window.__apiLoggerInstance) {
    window.__apiLoggerInstance = new ApiLogger();
    console.log('[ApiLogger] Created new global instance');

    // Load logs from localStorage on startup
    window.__apiLoggerInstance.loadFromLocalStorage();

    // Auto-save logs every 30 seconds
    setInterval(() => {
      window.__apiLoggerInstance.saveToLocalStorage();
    }, 30000);
  } else {
    console.log('[ApiLogger] Reusing existing global instance with', window.__apiLoggerInstance.logs.length, 'logs');
  }
  apiLoggerInstance = window.__apiLoggerInstance;
} else {
  // Fallback for non-browser environments
  apiLoggerInstance = new ApiLogger();
}

export const apiLogger = apiLoggerInstance;
export default apiLogger;
