/**
 * Simple Node.js Logging Server
 * Receives log entries from the React app and writes them to disk
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;
const LOG_FILE = path.join(__dirname, 'logs', 'omada-api-log.txt');

// Middleware
app.use(cors()); // Allow requests from React app
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * POST /api/log
 * Receive a single log entry and append to file
 */
app.post('/api/log', (req, res) => {
  try {
    const { timestamp, type, apiType, endpoint, params, response, error, success, status, requestId, requestHeaders, responseHeaders, statusCode } = req.body;

    let logEntry = '';

    if (type === 'REQUEST') {
      const headersText = requestHeaders ? `\nRequest Headers:\n${JSON.stringify(requestHeaders, null, 2)}` : '';
      logEntry = `${timestamp}\n${type} - ${apiType}\nEndpoint: ${endpoint}\nRequest ID: ${requestId}${headersText}\nParams: ${JSON.stringify(params, null, 2)}\n${'='.repeat(80)}\n\n`;
    } else if (type === 'RESPONSE') {
      const statusText = success ? 'SUCCESS' : 'ERROR';
      const statusCodeText = statusCode ? `\nStatus Code: ${statusCode}` : '';
      const headersText = responseHeaders ? `\nResponse Headers:\n${JSON.stringify(responseHeaders, null, 2)}` : '';
      const body = success
        ? `Response: ${JSON.stringify(response, null, 2)}`
        : `Error: ${error}`;
      logEntry = `${timestamp}\n${type} - ${apiType}\nEndpoint: ${endpoint}\nRequest ID: ${requestId}\nStatus: ${statusText}${statusCodeText}${headersText}\n${body}\n${'='.repeat(80)}\n\n`;
    }

    // Append to log file
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');

    res.json({ success: true, message: 'Log entry written' });
  } catch (error) {
    console.error('Error writing log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/logs
 * Retrieve the entire log file content
 */
app.get('/api/logs', (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const logs = fs.readFileSync(LOG_FILE, 'utf8');
      res.type('text/plain').send(logs);
    } else {
      res.type('text/plain').send('No logs yet.');
    }
  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/logs
 * Clear the log file
 */
app.delete('/api/logs', (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '', 'utf8');
      res.json({ success: true, message: 'Logs cleared' });
    } else {
      res.json({ success: true, message: 'No logs to clear' });
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', logFile: LOG_FILE });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ Omada API Logging Server running on http://localhost:${PORT}`);
  console.log(`✓ Log file location: ${LOG_FILE}`);
  console.log(`✓ Ready to receive logs from React app\n`);
});
