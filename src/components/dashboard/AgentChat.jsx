/**
 * Agent Chat Component — Javi
 * AI assistant powered by Claude (Anthropic API)
 * Subscribes to API errors and proactively alerts the user
 * Supports dragging, docking, resizing, and fullscreen
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sendMessageToClaude, formatErrorContext, isClaudeConfigured, SYSTEM_PROMPT, MODEL, MAX_TOKENS } from '../../services/claudeApi';
import apiLogger from '../../services/apiLogger';
import './AgentChat.css';

/** Reusable avatar component — shows image if available, falls back to emoji */
const RoziBotAvatar = ({ className = '' }) => (
  <img
    src="/javi.png"
    alt="Javi"
    className={`rozibot-avatar-img ${className}`}
    onError={(e) => { e.target.style.display = 'none'; }}
  />
);

/**
 * Build a keyword→laneType map from live lane context.
 * Includes the label, common aliases, and the laneType itself.
 * Returns array sorted longest-first so "Logical Applications" matches before "Applications".
 */
const buildLaneKeywords = () => {
  const lanes = window.__rozibotContext?.lanes;
  if (!lanes?.length) return [];

  // Static aliases for common shorthand words → laneType
  const aliases = {
    'entitlements': 'EffectiveEntitlements',
    'entitlement': 'EffectiveEntitlements',
    'roles': 'Roles',
    'role': 'Roles',
    'accounts': 'Accounts',
    'account': 'Accounts',
    'systems': 'Systems',
    'system': 'Systems',
    'applications': 'LogicalApplications',
    'application': 'LogicalApplications',
    'apps': 'LogicalApplications',
    'violations': 'Violations',
    'violation': 'Violations',
    'policies': 'AssignmentPolicies',
    'policy': 'AssignmentPolicies',
    'requests': 'Requests',
    'request': 'Requests',
    'approvals': 'Approvals',
    'contexts': 'Contexts',
  };

  const map = new Map();

  // Add lane labels from live data (only lanes that actually exist)
  const activeLaneTypes = new Set(lanes.map(l => l.laneType));
  lanes.forEach(lane => {
    const label = lane.label || lane.laneType;
    map.set(label.toLowerCase(), lane.laneType);
  });

  // Add aliases, but only for lanes that are currently loaded
  for (const [keyword, laneType] of Object.entries(aliases)) {
    if (activeLaneTypes.has(laneType)) {
      map.set(keyword, laneType);
    }
  }

  // Sort longest keywords first to match "Logical Applications" before "Applications"
  return Array.from(map.entries()).sort((a, b) => b[0].length - a[0].length);
};

/**
 * Render message text with:
 * 1. [ITEM:LaneType:displayName] markers → item pills (select + filter)
 * 2. Lane keywords (from schema) → lane pills (expand lane)
 */
const renderMessageText = (text) => {
  // Strip unwanted formatting: markdown bold (**) and em dashes (—)
  text = text.replace(/\*\*/g, '').replace(/—/g, '-');

  const itemRegex = /\[ITEM:([A-Za-z]+):([^\]]+)\]/g;
  const filterRegex = /\[FILTER:(compliance|reason):([^\]]+)\]/g;
  const laneKeywords = buildLaneKeywords();

  // Track already-rendered pills — only the first occurrence becomes a pill, duplicates stay as plain text
  const seenPills = new Set();

  // Process a plain text string and replace lane keywords with pills
  const linkifyLaneKeywords = (str, keyPrefix) => {
    if (!laneKeywords.length || !str) return [str];

    // Build a combined regex from all keywords (word-boundary, case-insensitive)
    const escaped = laneKeywords.map(([kw]) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const kwRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

    const parts = [];
    let lastIdx = 0;
    let kwMatch;
    while ((kwMatch = kwRegex.exec(str)) !== null) {
      if (kwMatch.index > lastIdx) {
        parts.push(str.slice(lastIdx, kwMatch.index));
      }
      const matchedWord = kwMatch[1];
      const laneType = laneKeywords.find(([kw]) => kw === matchedWord.toLowerCase())?.[1];
      const pillKey = `lane:${matchedWord.toLowerCase()}`;
      if (laneType && !seenPills.has(pillKey)) {
        seenPills.add(pillKey);
        const isViolation = laneType === 'Violations';
        parts.push(
          <button
            key={`${keyPrefix}-kw-${kwMatch.index}`}
            className={`lane-pill${isViolation ? ' violation' : ''}`}
            title={`Open ${matchedWord} card`}
            onClick={() => {
              if (window.__rozibotActions) {
                window.__rozibotActions.expandLane(laneType);
              }
            }}
          >
            {matchedWord}
          </button>
        );
      } else {
        parts.push(matchedWord);
      }
      lastIdx = kwRegex.lastIndex;
    }
    if (lastIdx < str.length) {
      parts.push(str.slice(lastIdx));
    }
    return parts;
  };

  return text.split('\n').map((line, lineIdx) => {
    // First pass: split on [ITEM:...] and [FILTER:...] markers
    const segments = [];
    const combinedRegex = /\[ITEM:([A-Za-z]+):([^\]]+)\]|\[FILTER:(compliance|reason):([^\]]+)\]/g;
    let lastIndex = 0;
    let match;
    while ((match = combinedRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: line.slice(lastIndex, match.index) });
      }
      if (match[1]) {
        // [ITEM:LaneType:displayName]
        segments.push({ type: 'item', laneType: match[1], displayName: match[2], index: match.index });
      } else {
        // [FILTER:compliance|reason:value]
        segments.push({ type: 'filter', filterType: match[3], value: match[4], index: match.index });
      }
      lastIndex = combinedRegex.lastIndex;
    }
    if (lastIndex < line.length) {
      segments.push({ type: 'text', value: line.slice(lastIndex) });
    }
    if (!segments.length) {
      segments.push({ type: 'text', value: line });
    }

    // Second pass: render segments, linkifying keywords in text segments
    const rendered = segments.flatMap((seg, segIdx) => {
      if (seg.type === 'item') {
        const itemPillKey = `item:${seg.laneType}:${seg.displayName.toLowerCase()}`;
        if (seenPills.has(itemPillKey)) {
          return seg.displayName; // Duplicate — render as plain text
        }
        seenPills.add(itemPillKey);
        const isViolationItem = seg.laneType === 'Violations';
        return (
          <button
            key={`${lineIdx}-item-${seg.index}`}
            className={`item-pill${isViolationItem ? ' violation' : ''}`}
            title={`Focus on ${seg.displayName}`}
            onClick={() => {
              if (window.__rozibotActions) {
                window.__rozibotActions.selectItem(seg.laneType, seg.displayName);
              }
            }}
          >
            {seg.displayName}
          </button>
        );
      }
      if (seg.type === 'filter') {
        const filterPillKey = `filter:${seg.filterType}:${seg.value.toLowerCase()}`;
        if (seenPills.has(filterPillKey)) {
          return seg.value;
        }
        seenPills.add(filterPillKey);
        const isWarning = seg.value === 'Not Approved' || seg.value === 'In Violation' || seg.value === 'None' || seg.value === 'Orphan Assignment';
        return (
          <button
            key={`${lineIdx}-filter-${seg.index}`}
            className={`filter-pill${isWarning ? ' warning' : ''}`}
            title={`Filter by ${seg.filterType === 'compliance' ? 'compliance status' : 'reason type'}: ${seg.value}`}
            onClick={() => {
              if (window.__rozibotActions) {
                window.__rozibotActions.setFilter(seg.filterType, seg.value);
              }
            }}
          >
            {seg.value}
          </button>
        );
      }
      // Text segment — linkify lane keywords
      return linkifyLaneKeywords(seg.value, `${lineIdx}-${segIdx}`);
    });

    return <span key={lineIdx}>{rendered}<br /></span>;
  });
};

/**
 * Parse action markers and trailing questions from Claude's response.
 * Priority: [ACTION:...] markers first, then auto-detect trailing questions.
 * Returns { cleanText, action } where action is null if nothing detected.
 */
const parseActionMarkers = (text) => {
  // 1. Check for explicit action markers
  const actionRegex = /\[ACTION:expand_lane:([A-Za-z]+):([^\]]+)\]\s*$/;
  const actionMatch = text.match(actionRegex);
  if (actionMatch) {
    return {
      cleanText: text.slice(0, actionMatch.index).trimEnd(),
      action: {
        type: 'expand_lane',
        laneType: actionMatch[1],
        question: actionMatch[2],
        handled: false,
        accepted: null,
      },
    };
  }

  // 2. Auto-detect trailing question — extract last sentence ending with ?
  const trimmed = text.trimEnd();
  if (trimmed.endsWith('?')) {
    // Find the last question sentence (after last newline or sentence boundary)
    const lines = trimmed.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    // Extract the question part (last sentence ending with ?)
    const questionMatch = lastLine.match(/([^.!?\n]*\?)\s*$/);
    if (questionMatch) {
      const question = questionMatch[1].trim();
      // Only create pills for genuine questions (not too short, not just "?")
      if (question.length > 10) {
        return {
          cleanText: trimmed,
          action: {
            type: 'followup_question',
            question,
            handled: false,
            accepted: null,
          },
        };
      }
    }
  }

  return { cleanText: text, action: null };
};

/**
 * Extract rich page context from the current DOM and route.
 * This gives RoziBot deep awareness of what the user is currently looking at.
 */
const extractPageContext = (pathname) => {
  const context = { page: pathname };
  const text = (el) => el?.textContent?.trim() || '';

  if (pathname === '/' || pathname === '/dashboard') {
    context.pageName = 'Dashboard';
    context.description = 'Home dashboard with governance metrics, compliance heatmaps, and quick navigation';
  } else if (pathname === '/identity360' || pathname === '/access-lens') {
    context.pageName = 'Identity360 Access Lens';
    context.description = 'Interactive access visualization showing identity/NHI relationships as focus nodes and lanes';

    // Focus Card (central identity/NHI node)
    const focusName = document.querySelector('.focus-name');
    if (focusName) context.focusNode = text(focusName);
    const focusType = document.querySelector('.focus-type-badge');
    if (focusType) context.focusNodeType = text(focusType);
    const focusStatus = document.querySelector('.focus-status');
    if (focusStatus) context.focusStatus = text(focusStatus);
    const focusRisk = document.querySelector('.focus-risk');
    if (focusRisk) context.focusRisk = text(focusRisk);
    // Focus metadata (key-value pairs like AppId, ObjectId, etc.)
    const metaItems = document.querySelectorAll('.focus-meta-item');
    if (metaItems.length) {
      context.focusMetadata = {};
      metaItems.forEach(item => {
        const label = text(item.querySelector('.meta-label'));
        const value = text(item.querySelector('.meta-value'));
        if (label && value) context.focusMetadata[label] = value;
      });
    }
    // Violations
    const violationCount = document.querySelector('.focus-violations-indicator .violation-count');
    if (violationCount) context.violationCount = text(violationCount);

    // Lanes: prefer window.__rozibotContext (has ALL items even when collapsed)
    const rCtx = window.__rozibotContext;
    if (rCtx?.lanes?.length) {
      context.lanes = rCtx.lanes.map(lane => {
        // Use React state for expanded status (more reliable than DOM)
        const expandedFromState = rCtx.laneExpandedStates?.[lane.laneType];
        const isExpanded = expandedFromState !== undefined
          ? expandedFromState
          : !rCtx.lanesForceCollapsed;
        return {
          title: lane.label || lane.laneType,
          count: String(lane.totalItems),
          type: lane.laneType,
          icon: lane.icon,
          isExpanded,
          isFilterSource: document.querySelector(`.lane-card[data-lane-type="${lane.laneType}"]`)?.classList.contains('filter-source') ?? false,
          isFiltered: document.querySelector(`.lane-card[data-lane-type="${lane.laneType}"]`)?.classList.contains('filtered') ?? false,
          items: lane.items.map(item => {
            const parts = [item.displayName];
            if (item.type) parts.push(`(${item.type})`);
            if (item.permissionName) parts.push(`permission: ${item.permissionName}`);
            if (item.permissionType) parts.push(`[${item.permissionType}]`);
            if (item.resourceDisplayName) parts.push(`api: ${item.resourceDisplayName}`);
            if (item.role) parts.push(`role: ${item.role}`);
            if (item.roleCategory) parts.push(`[${item.roleCategory}]`);
            if (item.roleType) parts.push(`roleType: ${item.roleType}`);
            if (item.scope) parts.push(`scope: ${item.scope}`);
            if (item.status) parts.push(`status: ${item.status}`);
            if (item.compliance) parts.push(`compliance: ${item.compliance}`);
            if (item.system) parts.push(`system: ${item.system}`);
            if (item.accountType) parts.push(`accountType: ${item.accountType}`);
            if (item.approvalStatus) parts.push(`approval: ${item.approvalStatus}`);
            if (item.violationStatus) parts.push(`violation: ${item.violationStatus}`);
            if (item.description && item.description.length < 80) parts.push(`- ${item.description}`);
            if (item.badges?.length) parts.push(`badges: [${item.badges.join(', ')}]`);
            return parts.join(' ');
          }),
          totalItems: lane.totalItems,
        };
      });
      if (rCtx.selectedItem) {
        const sel = rCtx.selectedItem;
        const selNode = sel.node || sel;
        context.selectedItem = selNode.displayName || selNode.name || sel.displayName || JSON.stringify(sel);
      }
    } else {
      // Fallback: read from DOM (only gets expanded lane items)
      const laneCards = document.querySelectorAll('.lane-card');
      if (laneCards.length) {
        context.lanes = [];
        laneCards.forEach(lane => {
          const laneInfo = {
            title: text(lane.querySelector('.lane-title')),
            count: text(lane.querySelector('.lane-count')),
            type: lane.getAttribute('data-lane-type') || '',
            isExpanded: lane.classList.contains('expanded'),
            isFilterSource: lane.classList.contains('filter-source'),
            isFiltered: lane.classList.contains('filtered'),
          };
          const items = lane.querySelectorAll('.lane-item-row .lane-item-name');
          if (items.length) {
            laneInfo.items = Array.from(items).slice(0, 5).map(el => text(el)).filter(Boolean);
            if (items.length > 5) laneInfo.items.push(`... and ${items.length - 5} more`);
          }
          context.lanes.push(laneInfo);
        });
      }
    }

    // Active filtering state
    const filteringIndicator = document.querySelector('.filtering-indicator');
    if (filteringIndicator) context.isFilteringActive = true;
    const clearBtn = document.querySelector('.clear-selections-btn');
    if (clearBtn) context.hasActiveSelections = true;

    // Filter dropdowns — available options and active selections (from React state, not DOM)
    if (rCtx?.filters) {
      context.filters = {
        visibleLanes: rCtx.filters.visibleLanes || [],
        entitlementType: rCtx.filters.entitlementType || 'all',
        multiPathOnly: rCtx.filters.multiPathOnly || false,
        highRiskOnly: rCtx.filters.highRiskOnly || false,
        // Reason Type filter
        selectedReasonTypes: rCtx.filters.reasonTypes || [],
        availableReasonTypes: rCtx.availableReasonTypes || [],
        // Compliance Status filter
        selectedComplianceStatuses: rCtx.filters.complianceStatuses || [],
        availableComplianceStatuses: rCtx.availableComplianceStatuses || [],
      };
    }

  } else if (pathname === '/identities') {
    context.pageName = 'Identities List';
    context.description = 'Searchable list of all human identities from Omada IGA';
  } else if (pathname === '/nhi') {
    context.pageName = 'Non-Human Identities (NHI)';
    context.description = 'List of app registrations, managed identities, service principals, and Copilot agents from Entra ID';
    const rows = document.querySelectorAll('table tbody tr');
    if (rows.length) context.tableRowCount = rows.length;
  } else if (pathname === '/logs') {
    context.pageName = 'API Log Viewer';
    context.description = 'Real-time log of all API requests/responses (Graph, ARM, Dataverse, Power Platform)';
  } else if (pathname === '/settings') {
    context.pageName = 'Settings';
    context.description = 'Application configuration and dashboard layout settings';
  } else if (pathname === '/access-requests') {
    context.pageName = 'Access Requests';
    context.description = 'List of access requests from Omada IGA';
  } else if (pathname === '/admin') {
    context.pageName = 'Administration';
    context.description = 'Admin panel for app configuration';
  }

  // Extract any visible error banners or alerts from the page
  const errorBanners = document.querySelectorAll('.load-error, .alert-danger, .api-error-banner');
  if (errorBanners.length) {
    context.pageErrors = Array.from(errorBanners).slice(0, 3).map(el => text(el).substring(0, 200)).filter(Boolean);
  }

  return context;
};

const AgentChat = ({ isOpen, onClose, isDocked, onToggleDock }) => {
  const location = useLocation();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'agent',
      text: "Hello! I'm your Javi, the Identity360 AI assistant. I can help you understand access data, assess security risks, and guide you through the Access Lens. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const [apiErrors, setApiErrors] = useState([]);
  const [errorBadgeCount, setErrorBadgeCount] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatRef = useRef(null);
  const lastErrorAlertRef = useRef(0);
  // Ref to always have latest conversationHistory in sendPromptToAgent
  const conversationHistoryRef = useRef(conversationHistory);
  conversationHistoryRef.current = conversationHistory;

  // Quick action pills — security-focused for IGA context
  const quickActions = [
    {
      label: 'Explain Screen Contents',
      icon: '\u{1F4C4}',
      prompt: 'What am I looking at right now? Give me a quick summary of this identity or app and its access.'
    },
    {
      label: 'Security Review',
      icon: '\u{1F6E1}\uFE0F',
      prompt: 'Do a quick security check on what\'s on screen. What are the top concerns I should know about?'
    },
    {
      label: 'Help',
      icon: '\u2753',
      // Populates input for user to send
      prompt: null
    }
  ];

  // Clamp position so at least 100px of the window stays visible
  const clampPosition = useCallback((x, y, w, h) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(-w + 100, Math.min(x, vw - 100)),
      y: Math.max(0, Math.min(y, vh - 60))
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Subscribe to API errors from apiLogger — proactive per-error alerts
  useEffect(() => {
    const unsubscribe = apiLogger.onActivity((event) => {
      if (event.type !== 'response') return;

      const logs = apiLogger.logs;
      const latest = logs[logs.length - 1];

      if (latest?.type === 'RESPONSE' && !latest.success && latest.statusCode) {
        const errorEntry = {
          statusCode: latest.statusCode,
          endpoint: latest.endpoint,
          error: latest.error,
          timestamp: latest.timestamp
        };

        setApiErrors(prev => [...prev, errorEntry].slice(-20));
        setErrorBadgeCount(prev => prev + 1);

        // Proactive alert in chat (debounced to max once per 3 seconds)
        const now = Date.now();
        if (now - lastErrorAlertRef.current > 3000 && isOpen) {
          lastErrorAlertRef.current = now;
          const shortEndpoint = (latest.endpoint || 'unknown').split('?')[0].slice(-60);
          setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'agent',
            isError: true,
            text: `API Error: ${latest.statusCode} on ${shortEndpoint}\n${latest.error || 'No details available'}\n\nWould you like me to analyze this error?`,
            timestamp: new Date()
          }]);
        }
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Build system context string from page context + API errors
  const buildSystemContext = useCallback(() => {
    const pageContext = extractPageContext(location.pathname);
    const parts = [];

    parts.push(`Current page: ${pageContext.pageName || pageContext.page}`);
    if (pageContext.description) parts.push(`Page description: ${pageContext.description}`);
    if (pageContext.focusNode) parts.push(`Focus node: ${pageContext.focusNode}${pageContext.focusNodeType ? ` (${pageContext.focusNodeType})` : ''}`);
    if (pageContext.focusStatus) parts.push(`Focus status: ${pageContext.focusStatus}`);
    if (pageContext.focusRisk) parts.push(`Focus risk: ${pageContext.focusRisk}`);
    if (pageContext.focusMetadata) {
      parts.push(`Focus metadata: ${Object.entries(pageContext.focusMetadata).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    if (pageContext.violationCount) parts.push(`Violation count: ${pageContext.violationCount}`);

    if (pageContext.lanes?.length) {
      parts.push(`\nLanes (${pageContext.lanes.length}):`);
      pageContext.lanes.forEach(lane => {
        const flags = [
          lane.isExpanded && 'expanded',
          lane.isFilterSource && 'filter-source',
          lane.isFiltered && 'filtered'
        ].filter(Boolean).join(', ');
        parts.push(`  - ${lane.title} (${lane.count} items)${flags ? ` [${flags}]` : ''}`);
        if (lane.items?.length) {
          lane.items.slice(0, 10).forEach(item => parts.push(`    ${item}`));
          if (lane.items.length > 10) parts.push(`    ... and ${lane.items.length - 10} more`);
        }
      });
    }

    if (pageContext.selectedItem) parts.push(`\nSelected item: ${pageContext.selectedItem}`);
    if (pageContext.isFilteringActive) parts.push('Cross-lane filtering is active');
    if (pageContext.hasActiveSelections) parts.push('User has active lane selections');

    // Filter state — what's available and what's selected
    if (pageContext.filters) {
      const f = pageContext.filters;
      parts.push(`\nToolbar Filters:`);
      parts.push(`  Visible lanes: ${f.visibleLanes.join(', ')}`);
      parts.push(`  Entitlement type: ${f.entitlementType}`);
      if (f.multiPathOnly) parts.push('  Multi-path filter: ON (showing only entitlements with multiple assignment paths)');
      if (f.highRiskOnly) parts.push('  High-risk filter: ON');
      // Reason Types
      if (f.availableReasonTypes.length > 0) {
        parts.push(`  Reason Types available: ${f.availableReasonTypes.join(', ')}`);
        if (f.selectedReasonTypes.length > 0) {
          parts.push(`  Reason Types SELECTED: ${f.selectedReasonTypes.join(', ')}`);
        } else {
          parts.push('  Reason Types selected: none (showing all)');
        }
      }
      // Compliance Statuses
      if (f.availableComplianceStatuses.length > 0) {
        parts.push(`  Compliance Statuses available: ${f.availableComplianceStatuses.join(', ')}`);
        if (f.selectedComplianceStatuses.length > 0) {
          parts.push(`  Compliance Statuses SELECTED: ${f.selectedComplianceStatuses.join(', ')}`);
        } else {
          parts.push('  Compliance Statuses selected: none (showing all)');
        }
      }
    }

    if (pageContext.pageErrors?.length) {
      parts.push(`\nPage errors visible: ${pageContext.pageErrors.join('; ')}`);
    }

    // Add API error context
    const errorContext = formatErrorContext(apiErrors);
    if (errorContext) parts.push(`\n${errorContext}`);

    return parts.join('\n');
  }, [location.pathname, apiErrors]);

  // Fallback keyword responses when no API key is configured
  const getFallbackResponse = (userMessage) => {
    const lower = userMessage.toLowerCase();
    if (lower.includes('error') || lower.includes('api')) {
      return "I can help analyze API errors, but I need an Anthropic API key to be configured. Add VITE_ANTHROPIC_API_KEY to your .env file.\n\nGet your key from: https://console.anthropic.com/settings/keys";
    }
    if (lower.includes('help')) {
      return "I'm your Javi, the Identity360 AI assistant. Once configured with an API key, I can:\n\n- Analyze API errors in real-time\n- Assess security risks in access data\n- Guide you through the Access Lens\n- Explain IGA and NHI concepts\n\nAdd VITE_ANTHROPIC_API_KEY to your .env file to get started.";
    }
    return "I need an Anthropic API key to provide AI-powered responses. Add VITE_ANTHROPIC_API_KEY to your .env file.\n\nGet your key from: https://console.anthropic.com/settings/keys";
  };

  /**
   * Send a prompt programmatically to Claude (used by quick action pills).
   * Shows the prompt as a user message and calls the API.
   */
  const sendPromptToAgent = useCallback(async (promptText) => {
    if (isTyping) return;

    // Show as user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      text: promptText,
      timestamp: new Date()
    }]);
    setIsTyping(true);
    setErrorBadgeCount(0);

    if (!isClaudeConfigured()) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'agent',
          text: getFallbackResponse(promptText),
          timestamp: new Date()
        }]);
        setIsTyping(false);
      }, 500);
      return;
    }

    const currentHistory = conversationHistoryRef.current;
    const newHistory = [...currentHistory, { role: 'user', content: promptText }];
    setConversationHistory(newHistory);

    const systemContext = buildSystemContext();
    const result = await sendMessageToClaude(newHistory, systemContext);

    if (result.status === 'success') {
      const { cleanText, action } = parseActionMarkers(result.text);
      // Store full text (with marker) in conversation history so Claude sees its own actions
      setConversationHistory(prev => [...prev, { role: 'assistant', content: result.text }]);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'agent',
        text: cleanText,
        action: action || undefined,
        timestamp: new Date()
      }]);
    } else {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'agent',
        text: `Error: ${result.error}`,
        timestamp: new Date(),
        isError: true
      }]);
    }

    setIsTyping(false);
  }, [isTyping, buildSystemContext]);

  // Handle Yes/No response to action pills (both lane-expand and follow-up opinion)
  const handleActionResponse = useCallback((messageId, action, accepted) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      return { ...msg, action: { ...msg.action, handled: true, accepted } };
    }));

    if (!accepted) return;

    if (action.type === 'expand_lane') {
      if (!window.__rozibotActions) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'agent',
          text: 'Navigate to Access Lens first to interact with lanes.',
          timestamp: new Date()
        }]);
        return;
      }
      window.__rozibotActions.expandLane(action.laneType);

      // Follow up: offer opinion on the lane contents
      const laneName = action.laneType.replace(/([A-Z])/g, ' $1').trim();
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'agent',
          text: `Done! The ${laneName} lane is now open.`,
          action: {
            type: 'analyse_lane',
            laneType: action.laneType,
            question: `Would you like my opinion on the ${laneName.toLowerCase()}?`,
            handled: false,
            accepted: null,
          },
          timestamp: new Date()
        }]);
      }, 500);
    }

    if (action.type === 'analyse_lane') {
      const laneName = action.laneType.replace(/([A-Z])/g, ' $1').trim();
      sendPromptToAgent(`Analyse the ${laneName} lane in detail. What are the key findings, risks, and recommendations based on the items you can see?`);
    }

    if (action.type === 'followup_question') {
      // User clicked Yes on a trailing question — send affirmative to continue conversation
      sendPromptToAgent('Yes, please go ahead.');
    }
  }, [sendPromptToAgent]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;
    const userText = inputValue.trim();
    setInputValue('');
    await sendPromptToAgent(userText);
  }, [inputValue, isTyping, sendPromptToAgent]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = useCallback((action) => {
    if (isTyping) return;

    if (action.label === 'Help') {
      // Just populate input for user to customize
      setInputValue('Help');
      inputRef.current?.focus();
      return;
    }

    if (action.label === 'Show API Errors') {
      if (apiErrors.length === 0) {
        // No errors — show static message
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'agent',
          text: 'No API errors detected. All systems are healthy.',
          timestamp: new Date()
        }]);
        return;
      }
      // Has errors — send them to Claude for analysis
      const errorSummary = apiErrors.slice(-5).map((e, i) =>
        `${i + 1}. ${e.statusCode} ${e.endpoint}\n   ${e.error || 'no details'}`
      ).join('\n');
      sendPromptToAgent(`Analyze these recent API errors and explain what went wrong and how to fix each one:\n\n${errorSummary}`);
      return;
    }

    // For prompts that fire real Claude calls
    if (action.prompt) {
      sendPromptToAgent(action.prompt);
    }
  }, [isTyping, apiErrors, sendPromptToAgent]);

  // Handle mouse down on header (start dragging)
  const handleMouseDown = (e) => {
    if (isDocked || isFullscreen || e.target.closest('.agent-close-btn') || e.target.closest('.undock-btn') || e.target.closest('.fullscreen-btn')) return;

    setIsDragging(true);
    const rect = chatRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  // Double-click header to reset position (escape hatch)
  const handleHeaderDoubleClick = () => {
    if (isDocked || isFullscreen) return;
    setPosition({ x: window.innerWidth - size.width - 32, y: 32 });
  };

  // Handle resize start
  const handleResizeStart = (e, direction) => {
    if (isDocked || isFullscreen) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle mouse move (dragging and resizing)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && !isDocked && !isFullscreen) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        const clamped = clampPosition(newX, newY, size.width, size.height);
        setPosition(clamped);
      }

      if (isResizing && !isDocked && !isFullscreen) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(300, Math.min(resizeStart.width + deltaX, window.innerWidth - resizeStart.posX));
        }
        if (resizeDirection.includes('w')) {
          newWidth = Math.max(300, resizeStart.width - deltaX);
          newX = resizeStart.posX + (resizeStart.width - newWidth);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(400, Math.min(resizeStart.height + deltaY, window.innerHeight - resizeStart.posY));
        }
        if (resizeDirection.includes('n')) {
          newHeight = Math.max(400, resizeStart.height - deltaY);
          newY = resizeStart.posY + (resizeStart.height - newHeight);
        }

        setSize({ width: newWidth, height: newHeight });
        const clamped = clampPosition(newX, newY, newWidth, newHeight);
        setPosition(clamped);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, isDocked, isFullscreen, resizeDirection, resizeStart, clampPosition, size.width, size.height]);

  // Download the full context payload sent to Claude as JSON
  const handleDownloadContext = useCallback(() => {
    const systemContext = buildSystemContext();
    const fullSystemPrompt = systemContext
      ? `${SYSTEM_PROMPT}\n\n--- CURRENT APPLICATION CONTEXT ---\n${systemContext}`
      : SYSTEM_PROMPT;

    const payload = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: fullSystemPrompt,
      messages: conversationHistoryRef.current
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iga-agent-context-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildSystemContext]);

  const containerStyle = isFullscreen ? {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh'
  } : !isDocked ? {
    left: `${position.x}px`,
    top: `${position.y}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${size.width}px`,
    height: `${size.height}px`
  } : {};

  return (
    <div
      ref={chatRef}
      className={`agent-chat-container ${isOpen ? 'open' : ''} ${isDocked ? 'docked' : 'undocked'} ${isDragging ? 'dragging' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
      style={containerStyle}
    >
      {/* Chat Header */}
      <div
        className="agent-chat-header"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleHeaderDoubleClick}
        style={{ cursor: isDocked ? 'default' : 'move' }}
      >
        <div className="agent-header-content">
          <div className="agent-avatar">
            <RoziBotAvatar />
            {errorBadgeCount > 0 && (
              <span className="error-badge">{errorBadgeCount > 9 ? '9+' : errorBadgeCount}</span>
            )}
          </div>
          <div className="agent-info">
            <h3>Javi</h3>
            <span className="agent-status">
              <span className={`status-dot ${isClaudeConfigured() ? '' : 'offline'}`}></span>
              {isClaudeConfigured() ? 'Online' : 'No API Key'}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="download-context-btn"
            onClick={handleDownloadContext}
            title="Download context data (JSON)"
          >
            <span className="icon-text">⬇</span>
          </button>
          {!isDocked && (
            <button
              className="fullscreen-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Restore' : 'Maximize'}
            >
              <span className="icon-text">{isFullscreen ? '\u{1F5D7}' : '\u{1F5D6}'}</span>
            </button>
          )}
          <button
            className="undock-btn"
            onClick={onToggleDock}
            title={isDocked ? 'Undock window' : 'Minimize to dock'}
          >
            <span className="icon-text">{isDocked ? '\u{21F1}' : '\u{21F2}'}</span>
          </button>
          <button className="agent-close-btn" onClick={onClose} title="Close">
            <span className="icon-text">{'\u2715'}</span>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        {quickActions.map((action, index) => (
          <button
            key={index}
            className="quick-action-pill"
            onClick={() => handleQuickAction(action)}
            disabled={isTyping}
          >
            <span className="pill-icon">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="agent-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}${message.isError ? ' error' : ''}`}>
            {message.type === 'agent' && (
              <div className="message-avatar">
                <RoziBotAvatar />
              </div>
            )}
            <div className="message-content">
              <div className="message-bubble">
                {renderMessageText(message.text)}
              </div>
              {message.action && (
                <div className={`action-pills ${message.action.handled ? 'handled' : ''}`}>
                  <span className="action-prompt">{message.action.question}</span>
                  {!message.action.handled ? (
                    <>
                      <button
                        className="action-pill-yes"
                        onClick={() => handleActionResponse(message.id, message.action, true)}
                      >
                        Yes
                      </button>
                      <button
                        className="action-pill-no"
                        onClick={() => handleActionResponse(message.id, message.action, false)}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <span className="action-result">
                      {message.action.accepted ? 'Done!' : 'Skipped'}
                    </span>
                  )}
                </div>
              )}
              <div className="message-time">
                {message.timestamp.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
            {message.type === 'user' && (
              <div className="message-avatar user-avatar">{'\u{1F464}'}</div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="message agent">
            <div className="message-avatar">
              <RoziBotAvatar />
            </div>
            <div className="message-content">
              <div className="message-bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="agent-input-area">
        <textarea
          ref={inputRef}
          className="agent-input"
          placeholder={isClaudeConfigured() ? 'Ask Javi anything...' : 'API key required - see Help'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
        />
        <button
          className="agent-send-btn"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isTyping}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
          </svg>
        </button>
      </div>

      {/* Resize Handles - Only show when undocked and not fullscreen */}
      {!isDocked && !isFullscreen && (
        <>
          <div className="resize-handle resize-n" onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className="resize-handle resize-s" onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className="resize-handle resize-e" onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className="resize-handle resize-w" onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className="resize-handle resize-ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="resize-handle resize-nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="resize-handle resize-se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          <div className="resize-handle resize-sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
        </>
      )}
    </div>
  );
};

export default AgentChat;
