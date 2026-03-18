# AGENT.md — RoZiBoT Claude AI Integration Blueprint

> **Purpose**: Complete instructions for Claude Code to recreate the RoZiBoT AI assistant in any Vite + React project.
> This document captures every file, configuration, and pattern used to integrate the Anthropic Claude API
> into the Identity360 application as an embedded AI chat assistant called RoZiBoT.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Vite Proxy Configuration](#3-vite-proxy-configuration)
4. [Claude API Service](#4-claude-api-service)
5. [Agent Chat Component (JSX)](#5-agent-chat-component-jsx)
6. [Agent Chat Stylesheet (CSS)](#6-agent-chat-stylesheet-css)
7. [Page Context Bridge (window.__rozibotContext)](#7-page-context-bridge)
8. [Mounting RoZiBoT in the App](#8-mounting-rozibot-in-the-app)
9. [Avatar Image](#9-avatar-image)
10. [Quick Action Pills](#10-quick-action-pills)
11. [System Prompt (Invisible Prefix)](#11-system-prompt-invisible-prefix)
12. [API Error Subscription](#12-api-error-subscription)
13. [Drag, Resize, Dock, Fullscreen](#13-drag-resize-dock-fullscreen)
14. [Anthropic API Call Flow](#14-anthropic-api-call-flow)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Prerequisites

- **Node.js** 18+
- **Vite** (any version with `server.proxy` support)
- **React** 18+ with React Router
- **Anthropic API Key** — get one at https://console.anthropic.com/settings/keys
  - Requires billing enabled with credit balance (minimum $5 recommended)
  - This is separate from any Claude Pro/Max subscription
- No additional npm packages required — uses native `fetch`

---

## 2. Environment Variables

Add to your `.env` file in the project root:

```env
# Anthropic Claude API Key — powers RoZiBoT AI assistant
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**Important**: The key MUST be prefixed with `VITE_` for Vite to expose it to the browser via `import.meta.env`.

**Security note**: This key is exposed to the browser in development. For production, proxy the API call through your own backend and never expose the key client-side.

---

## 3. Vite Proxy Configuration

The Anthropic API does not allow direct browser requests (CORS). In development, Vite's built-in proxy forwards requests to avoid this.

Add this to `vite.config.js` inside the `server.proxy` object:

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy Anthropic Claude API to avoid CORS issues in development
      '/anthropic-api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/anthropic-api/, ''),
      },
    }
  }
})
```

**How it works**:
- Browser sends `POST /anthropic-api/v1/messages`
- Vite rewrites to `POST https://api.anthropic.com/v1/messages`
- Response flows back to the browser without CORS issues
- The `changeOrigin: true` sets the `Host` header to `api.anthropic.com`

---

## 4. Claude API Service

Create `src/services/claudeApi.js` — this is the entire API integration layer:

```javascript
/**
 * Claude API Service — powers the RoziBot AI assistant
 * Calls the Anthropic Messages API directly from the browser.
 *
 * API Key: Set VITE_ANTHROPIC_API_KEY in .env
 * Docs: https://docs.anthropic.com/en/api/messages
 */

// In dev, use Vite proxy to avoid CORS. In prod, call Anthropic directly.
const ANTHROPIC_API_URL = import.meta.env.DEV
  ? '/anthropic-api/v1/messages'
  : 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;
const DEBUG = true; // Log API calls to console for debugging

/**
 * System prompt — invisible to the user, sent with every API call.
 * Customise this for your application's domain.
 */
const SYSTEM_PROMPT = `You are RoZiBoT, the AI assistant embedded in Identity360 — an identity governance & NHI (Non-Human Identity) security application built on Omada IGA and Microsoft Entra ID.

You are an IGA security expert and your responses will prioritise Risk, Security (least privilege) and Identity Governance practices. You can query Microsoft web resources to answer questions with summaries from the web.

Your responsibilities:
1. Help users understand and resolve API errors that occur in the application
2. Explain identity governance concepts (roles, entitlements, policies, access requests, approvals)
3. Explain NHI concepts (app registrations, managed identities, service principals, Copilot agents, RBAC, API permissions)
4. Guide users through the Access Lens visualization (focus nodes, lanes, cross-lane filtering)
5. Answer questions about Azure/Entra ID, Microsoft Graph API, ARM API, Power Platform/Dataverse APIs
6. Assess and highlight security risks: over-privileged identities, stale credentials, missing conditional access, excessive API permissions, owner/contributor role sprawl
7. Recommend least-privilege alternatives when reviewing RBAC assignments or API permission grants

When reviewing access data shown on screen:
- Flag any privileged administrator roles (Owner, Contributor, User Access Administrator) and question whether they follow least-privilege
- Highlight credentials nearing expiry or already expired
- Note any NHIs without conditional access policies as a gap
- Identify over-scoped API permissions (e.g. Directory.ReadWrite.All when Read would suffice)

When API errors are shared with you:
- Explain what the error means in plain English
- Suggest the likely cause (missing permissions, wrong ID, expired token, etc.)
- Recommend specific fixes (which API permission to add, which scope to consent, etc.)
- Reference Microsoft docs where helpful

Keep responses concise and actionable. Use bullet points for multi-step fixes.
Do not use emojis excessively. Be professional but friendly.`;

/**
 * Send a message to Claude and get a response.
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {string} [systemContext] - Additional system context (e.g., recent API errors, page state)
 * @returns {Promise<{status: string, text: string, error?: string}>}
 */
export const sendMessageToClaude = async (messages, systemContext = '') => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 'error',
      text: '',
      error: 'Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to your .env file.\n\nGet your key from: https://console.anthropic.com/settings/keys'
    };
  }

  // Merge system prompt with runtime context (page state, errors, etc.)
  const systemPrompt = systemContext
    ? `${SYSTEM_PROMPT}\n\n--- CURRENT APPLICATION CONTEXT ---\n${systemContext}`
    : SYSTEM_PROMPT;

  try {
    if (DEBUG) console.log('[RoziBot] Sending to Claude:', { model: MODEL, messagesCount: messages.length, hasContext: !!systemContext });
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,    // <-- invisible prefix goes here
        messages,                 // <-- conversation history [{role, content}, ...]
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `Claude API error (${res.status})`;
      let errorType = '';
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorMsg;
        errorType = errorJson.error?.type || '';
      } catch { /* use default */ }
      if (DEBUG) console.error('[RoziBot] Claude API error:', res.status, errorType, errorMsg);
      return { status: 'error', text: '', error: errorMsg };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return { status: 'success', text };
  } catch (err) {
    if (DEBUG) console.error('[RoziBot] Network/fetch error:', err);
    return { status: 'error', text: '', error: `Network error: ${err.message}` };
  }
};

/**
 * Format recent API errors into a context string for Claude.
 *
 * @param {Array} errorLogs - Array of apiLogger error entries
 * @returns {string} Formatted context string
 */
export const formatErrorContext = (errorLogs) => {
  if (!errorLogs?.length) return '';

  const recent = errorLogs.slice(-5); // Last 5 errors
  const lines = recent.map((log, i) => {
    const status = log.statusCode || 'unknown';
    const endpoint = log.endpoint || 'unknown';
    const error = log.error || 'no details';
    return `Error ${i + 1}: ${status} ${endpoint}\n  Detail: ${error}`;
  });

  return `Recent API errors in Identity360:\n${lines.join('\n\n')}`;
};

/**
 * Check if the Claude API is configured (key present).
 */
export const isClaudeConfigured = () => {
  return !!import.meta.env.VITE_ANTHROPIC_API_KEY;
};
```

### Key design decisions:
- **`system` parameter**: The invisible system prompt is sent via the Anthropic API's `system` field, NOT as a user message. The user never sees it.
- **Context injection**: Runtime context (current page state, API errors) is appended to the system prompt after a `--- CURRENT APPLICATION CONTEXT ---` separator.
- **Conversation history**: The full `messages` array is sent on every call, maintaining multi-turn conversation context.
- **`anthropic-dangerous-direct-browser-access: true`**: Required header when calling the API from a browser (via proxy). Remove this if calling from a backend.

---

## 5. Agent Chat Component (JSX)

Create `src/components/dashboard/AgentChat.jsx`:

The full component source is in the Identity360 repository at `src/components/dashboard/AgentChat.jsx` (700 lines).

### Core architecture:

```
AgentChat.jsx
├── extractPageContext(pathname)     — DOM scraping + window.__rozibotContext
├── AgentChat component
│   ├── State: messages, conversationHistory, inputValue, isTyping
│   ├── State: position, size, isDragging, isResizing (window management)
│   ├── State: apiErrors, errorBadgeCount (error monitoring)
│   ├── useEffect: subscribe to apiLogger for proactive error alerts
│   ├── handleSendMessage()          — sends user input to Claude with full page context
│   ├── sendPromptToAgent(prompt)    — programmatic send (used by quick action pills)
│   ├── handleQuickAction(action)    — pill click handler
│   ├── getFallbackResponse()        — offline responses when no API key
│   └── Render: header, pills, messages, input, resize handles
```

### Imports required:
```javascript
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sendMessageToClaude, formatErrorContext, isClaudeConfigured } from '../../services/claudeApi';
import apiLogger from '../../services/apiLogger';  // Your app's API logger (optional)
import './AgentChat.css';
```

### Component props:
```javascript
const AgentChat = ({ isOpen, onClose, isDocked, onToggleDock }) => { ... }
```

### Context extraction function:
This is the key function that makes RoZiBoT "see" the page. It:
1. Checks `window.__rozibotContext` for rich data (preferred — has all items including collapsed)
2. Falls back to DOM queries using CSS selectors matching your app's class names
3. Returns a structured object with page name, focus node, lanes, items, metadata

```javascript
const extractPageContext = (pathname) => {
  const context = { page: pathname };
  const text = (el) => el?.textContent?.trim() || '';

  // Route-specific context
  if (pathname === '/identity360' || pathname === '/access-lens') {
    context.pageName = 'Identity360 Access Lens';
    context.description = 'Interactive access visualization';

    // Read focus card from DOM
    const focusName = document.querySelector('.focus-name');
    if (focusName) context.focusNode = text(focusName);
    // ... more DOM queries for type, status, risk, metadata

    // Read lane data from window.__rozibotContext (preferred)
    const rCtx = window.__rozibotContext;
    if (rCtx?.lanes?.length) {
      context.lanes = rCtx.lanes.map(lane => ({
        title: lane.label || lane.laneType,
        count: String(lane.totalItems),
        items: lane.items.map(item => {
          // Build human-readable string per item
          const parts = [item.displayName];
          if (item.role) parts.push(`role: ${item.role}`);
          if (item.permissionName) parts.push(`permission: ${item.permissionName}`);
          // ... more fields
          return parts.join(' ');
        }),
      }));
    }
  }

  return context;
};
```

### Building context for Claude:
The context is built as a plain-text string and passed as `systemContext` to `sendMessageToClaude`:

```javascript
const pageCtx = extractPageContext(location.pathname);
const ctxParts = [`Current page: ${pageCtx.pageName || pageCtx.page}`];
if (pageCtx.focusNode) ctxParts.push(`Focus node: ${pageCtx.focusNode}`);
if (pageCtx.lanes?.length) {
  ctxParts.push(`\nVisible lanes (${pageCtx.lanes.length}):`);
  pageCtx.lanes.forEach(lane => {
    let laneStr = `  - ${lane.title} (${lane.count} items)`;
    if (lane.items?.length) laneStr += `\n    Items: ${lane.items.join(', ')}`;
    ctxParts.push(laneStr);
  });
}
const fullContext = ctxParts.join('\n');
const result = await sendMessageToClaude(newHistory, fullContext);
```

---

## 6. Agent Chat Stylesheet (CSS)

Create `src/components/dashboard/AgentChat.css`.

The full stylesheet is in the Identity360 repository (544 lines). Key classes:

| Class | Purpose |
|-------|---------|
| `.agent-chat-container` | Fixed-position chat panel (400x600px default) |
| `.agent-chat-container.open` | Slide-up animation via `transform` |
| `.agent-chat-container.docked` | Docked to bottom-right corner |
| `.agent-chat-container.undocked` | Free-floating, draggable |
| `.agent-chat-container.fullscreen` | Takes entire viewport |
| `.agent-chat-header` | Blue gradient header bar with avatar and controls |
| `.agent-avatar` | 36px circle for bot avatar image |
| `.rozibot-avatar-img` | `border-radius: 50%; object-fit: cover` for the photo |
| `.quick-actions` | Flex container for pill buttons |
| `.quick-action-pill` | Rounded pill button with hover animation |
| `.agent-messages` | Scrollable message area |
| `.message.agent .message-bubble` | Dark bubble for bot messages |
| `.message.user .message-bubble` | Blue gradient bubble for user messages |
| `.message-avatar` | 28px circle per message |
| `.typing-indicator` | Three bouncing dots animation |
| `.agent-input-area` | Fixed bottom input bar with textarea + send button |
| `.agent-float-btn` | 50px floating action button (z-index: 9999) |
| `.resize-handle` | 8 directional resize handles around the panel |
| `.error-badge` | Red pill badge in header showing error count |
| `.error-bubble` | Red-tinted bubble for error messages |

**z-index**: The chat container uses `z-index: 10000` and the float button uses `z-index: 9999`. Set these higher than any other UI elements in your app.

---

## 7. Page Context Bridge

To let RoZiBoT "see" page data that isn't in the DOM (e.g., collapsed sections, React state), expose data via `window.__rozibotContext` from your page component:

```javascript
// In your page component (e.g., AccessLens.jsx)
useEffect(() => {
  window.__rozibotContext = {
    focusNode: state.focusNode,
    lanes: (state.lanes || []).map(lane => ({
      laneType: lane.laneType,
      label: lane.label || lane.laneType,
      icon: lane.icon,
      itemCount: lane.items?.length || 0,
      items: (lane.items || []).slice(0, 20).map(item => ({
        displayName: item.displayName || item.name || 'Unknown',
        type: item.type || item.nodeType || '',
        status: item.status || '',
        risk: item.risk || '',
        role: item.resolvedRole || item.role || '',
        scope: item.scope || '',
        permissionName: item.permissionName || '',
        permissionType: item.permissionType || '',
        resourceDisplayName: item.resourceDisplayName || '',
        compliance: item.complianceStatus || '',
        // Add any domain-specific fields your items have
      })),
      totalItems: lane.items?.length || 0,
    })),
    selectedItem: state.selectedItem,
    isLoading: state.isLoading,
  };

  return () => { delete window.__rozibotContext; };
}, [state.focusNode, state.lanes, state.selectedItem, state.isLoading]);
```

**Why this pattern**:
- React components conditionally render content (e.g., `{isExpanded && <div>...</div>}`)
- When a section is collapsed, items are NOT in the DOM and cannot be scraped
- `window.__rozibotContext` always has the full data regardless of UI state
- AgentChat reads this first, falling back to DOM scraping only if it's not available

---

## 8. Mounting RoZiBoT in the App

In your main App component or layout component, add:

```javascript
import { useState } from 'react';
import AgentChat from './components/dashboard/AgentChat';

function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDocked, setChatDocked] = useState(true);

  return (
    <div className="app">
      {/* Your app content */}
      <Routes>...</Routes>

      {/* RoZiBoT floating button */}
      <button
        className={`agent-float-btn ${chatOpen ? 'chat-open' : ''}`}
        onClick={() => setChatOpen(true)}
      >
        <img src="/ronald.jpg" alt="RoZiBoT" className="rozibot-avatar-img" />
      </button>

      {/* RoZiBoT chat panel */}
      <AgentChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        isDocked={chatDocked}
        onToggleDock={() => setChatDocked(!chatDocked)}
      />
    </div>
  );
}
```

---

## 9. Avatar Image

Place your bot avatar image in the `public/` folder:

```
public/ronald.jpg    (or any image file)
```

Referenced in JSX as:
```jsx
<img src="/ronald.jpg" alt="RoZiBoT" className="rozibot-avatar-img" />
```

Used in three places:
1. Chat header avatar (`.agent-avatar`)
2. Bot message avatar (`.message-avatar`)
3. Typing indicator avatar
4. Floating action button

CSS for circular crop:
```css
.rozibot-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
```

---

## 10. Quick Action Pills

Pills are pre-configured prompts that fire real Claude API calls:

```javascript
const quickActions = [
  { label: 'Explain Screen Contents', icon: '📄' },
  { label: 'Security Review', icon: '🛡️' },
  { label: 'Show API Errors', icon: '🔴' },
  { label: 'Help', icon: '❓' }
];
```

**"Explain Screen Contents"** sends:
```
Explain what is currently shown on screen. Describe the focus node, its type, status,
and each access lane with its items. Summarise what this identity or NHI is and what
access it has, in plain English.
```

**"Security Review"** sends:
```
Perform a security review of the identity or NHI currently on screen. Check for:
over-privileged roles (Owner, Contributor, User Access Administrator), excessive API
permissions (ReadWrite when Read would suffice), expired or soon-to-expire credentials,
missing conditional access policies, multi-tenant exposure risks, orphaned owners, and
any least-privilege violations. Flag each finding with a severity (Critical, High,
Medium, Low) and recommend a remediation action.
```

Both use `sendPromptToAgent()` which builds the full page context and sends it to Claude — identical to what happens when the user types a message manually.

**"Show API Errors"** checks if there are errors; if yes, sends them to Claude for analysis. If none, shows a static "all healthy" message.

**"Help"** populates the input field with "Help" for the user to send.

---

## 11. System Prompt (Invisible Prefix)

The `SYSTEM_PROMPT` constant in `claudeApi.js` is sent with every API call via the Anthropic `system` parameter. The user never sees this text — it instructs Claude's behaviour.

**How it's injected**:
```javascript
body: JSON.stringify({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  system: systemPrompt,    // <-- SYSTEM_PROMPT + runtime context
  messages,                 // <-- user/assistant conversation history
}),
```

**Runtime context is appended**:
```javascript
const systemPrompt = systemContext
  ? `${SYSTEM_PROMPT}\n\n--- CURRENT APPLICATION CONTEXT ---\n${systemContext}`
  : SYSTEM_PROMPT;
```

This means Claude receives:
1. The static system prompt (identity, role, rules)
2. A separator
3. Dynamic page context (what's on screen right now)
4. Any recent API errors

All invisible to the user. The user only sees the `messages` array in the chat UI.

---

## 12. API Error Subscription

RoZiBoT proactively alerts users about API errors. This requires an `apiLogger` service that:
- Logs all API requests/responses
- Emits events via a pub/sub pattern (`onActivity` callback)

```javascript
// Subscribe to API errors
useEffect(() => {
  const unsubscribe = apiLogger.onActivity((event) => {
    if (event.type !== 'response') return;
    const logs = apiLogger.logs;
    const latest = logs[logs.length - 1];

    if (latest.type === 'RESPONSE' && !latest.success && latest.statusCode) {
      // Add to error state
      setApiErrors(prev => [...prev, errorEntry].slice(-20));
      setErrorBadgeCount(prev => prev + 1);

      // Proactive alert in chat (debounced to max once per 3 seconds)
      const now = Date.now();
      if (now - lastErrorAlertRef.current > 3000) {
        lastErrorAlertRef.current = now;
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'agent',
          isError: true,
          text: `🔴 API Error: ${latest.statusCode} on ${shortEndpoint}\n${latest.error}`,
          timestamp: new Date()
        }]);
      }
    }
  });
  return () => unsubscribe();
}, []);
```

**If you don't have an apiLogger**: Remove the `useEffect` subscription, the `apiErrors` state, and the error badge. The rest of RoZiBoT works without it.

---

## 13. Drag, Resize, Dock, Fullscreen

RoZiBoT supports four window modes:

| Mode | Behaviour |
|------|-----------|
| **Docked** (default) | Fixed bottom-right corner, no drag/resize |
| **Undocked** | Free-floating, draggable by header, resizable from 8 edges |
| **Fullscreen** | Fills entire viewport |
| **Reset** | Double-click header to reset position (escape hatch if off-screen) |

### Position clamping (prevents flying off-screen):
```javascript
const clampPosition = useCallback((x, y, w, h) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(-w + 100, Math.min(x, vw - 100)),
    y: Math.max(0, Math.min(y, vh - 60))
  };
}, []);
```

### Resize captures position at start:
```javascript
const handleResizeStart = (e, direction) => {
  setResizeStart({
    x: e.clientX, y: e.clientY,
    width: size.width, height: size.height,
    posX: position.x, posY: position.y   // <-- critical: capture position
  });
};
```

This prevents the window from jumping during resize — the position stays anchored to where it was when the resize began.

---

## 14. Anthropic API Call Flow

### Request format:
```
POST /anthropic-api/v1/messages  (proxied to https://api.anthropic.com/v1/messages)

Headers:
  Content-Type: application/json
  x-api-key: sk-ant-api03-...
  anthropic-version: 2023-06-01
  anthropic-dangerous-direct-browser-access: true

Body:
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "You are RoZiBoT... [SYSTEM_PROMPT + CONTEXT]",
  "messages": [
    { "role": "user", "content": "What permissions does this app have?" },
    { "role": "assistant", "content": "Based on what I can see..." },
    { "role": "user", "content": "Is that too much access?" }
  ]
}
```

### Response format:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Yes, the Directory.ReadWrite.All permission is over-scoped..."
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "role": "assistant",
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 1234, "output_tokens": 567 }
}
```

### Extracting the response:
```javascript
const data = await res.json();
const text = data.content?.[0]?.text || '';
```

### Maintaining conversation history:
```javascript
// After each exchange, append both user and assistant messages:
setConversationHistory([
  ...newHistory,                              // includes the new user message
  { role: 'assistant', content: agentText }   // Claude's response
]);
```

The full history is sent on every call — Claude has no server-side memory between requests.

---

## 15. Troubleshooting

### "Credit balance too low"
- Go to https://console.anthropic.com/settings/billing
- Add at least $5 of credits
- If the error persists after adding credits, create a **new API key** (old keys sometimes don't pick up billing changes)

### CORS errors in browser console
- Verify the Vite proxy is configured correctly in `vite.config.js`
- The proxy only works in `npm run dev` — in production you need a backend proxy

### "API key not configured"
- Ensure `VITE_ANTHROPIC_API_KEY` is in your `.env` file (not `.env.local`, `.env.example`, etc.)
- Restart the Vite dev server after changing `.env` — Vite caches env vars

### RoZiBoT can't see page contents
- Verify `window.__rozibotContext` is being set in your page component's `useEffect`
- Check that the CSS selectors in `extractPageContext` match your actual class names
- Open browser console and type `window.__rozibotContext` to inspect the data

### RoZiBoT shows GUIDs instead of names
- Your data layer needs to resolve IDs to display names before exposing to `window.__rozibotContext`
- Use Graph API `POST /directoryObjects/getByIds` to batch-resolve GUIDs
- Map `displayName || userPrincipalName || id` as fallback chain

### Chat window flies off screen
- Double-click the header to reset position
- The `clampPosition` function should keep at least 100px visible
- If resizing causes drift, ensure `resizeStart` captures `posX`/`posY`

### z-index conflicts
- Chat container: `z-index: 10000`
- Float button: `z-index: 9999`
- Increase these if your app has elements with higher z-index values

---

## File Summary

| File | Purpose |
|------|---------|
| `.env` | `VITE_ANTHROPIC_API_KEY` |
| `vite.config.js` | Proxy `/anthropic-api` → `api.anthropic.com` |
| `src/services/claudeApi.js` | API client, system prompt, error formatting |
| `src/components/dashboard/AgentChat.jsx` | Chat UI component (700 lines) |
| `src/components/dashboard/AgentChat.css` | Chat styling (544 lines) |
| `public/ronald.jpg` | Bot avatar image |
| Your page component | `window.__rozibotContext` bridge via `useEffect` |
| Your App component | Mount `<AgentChat>` + floating button |

---

*Generated from Identity360 project — March 2026*
