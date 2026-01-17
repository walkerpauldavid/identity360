# Omada API Logging Server

Automatic backend logging server that writes all Omada REST API calls to disk.

## Setup

1. **Install dependencies** (one-time):
```bash
npm install --prefix . --package-lock-only express cors
```

OR manually install:
```bash
npm install express cors
```

2. **Start the logging server** (in a separate terminal):
```bash
node log-server.js
```

You should see:
```
✓ Omada API Logging Server running on http://localhost:3001
✓ Log file location: C:\Users\demoadm\Documents\Code\sisense\hello-world-react\logs\omada-api-log.txt
✓ Ready to receive logs from React app
```

3. **Start your React app** (in another terminal):
```bash
npm run dev
```

## Log File Location

All API logs are automatically written to:
```
hello-world-react/logs/omada-api-log.txt
```

## How It Works

1. **React App** → Makes Omada API calls
2. **apiLogger.js** → Captures all requests/responses
3. **Sends to Backend** → POST http://localhost:3001/api/log
4. **Log Server** → Writes to `logs/omada-api-log.txt`

## API Endpoints

The log server provides these endpoints:

- `POST /api/log` - Receive and write log entry
- `GET /api/logs` - View all logs
- `DELETE /api/logs` - Clear log file
- `GET /health` - Server health check

## Disable Backend Logging

If you don't want to run the backend server, edit `src/services/apiLogger.js`:

```javascript
this.sendToBackend = false; // Disable backend logging
```

Logs will still appear in the browser console.

## Log Format

Each log entry includes:
- REQUEST/RESPONSE type
- OData or GraphQL API type
- Full endpoint URL
- Request parameters
- Response data or error messages
- Request ID for matching requests with responses

## Troubleshooting

**Logs not appearing in file?**
- Make sure log server is running (`node log-server.js`)
- Check browser console for "Failed to send log to backend" warnings
- Verify server is on http://localhost:3001

**Port 3001 already in use?**
- Edit `log-server.js` and change `PORT = 3001` to another port
- Update `src/services/apiLogger.js` backendUrl to match
