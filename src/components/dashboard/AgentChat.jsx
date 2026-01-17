/**
 * Agent Chat Component
 * Simulated AI agent chat interface with natural language interaction
 * Supports dragging and docking
 */

import { useState, useRef, useEffect } from 'react';
import './AgentChat.css';

const AgentChat = ({ isOpen, onClose, isDocked, onToggleDock }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'agent',
      text: "Hello! I'm RoZiBoT, your Omada assistant. I can help you with access requests, approvals, identity management, and more. How can I assist you today?",
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
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatRef = useRef(null);

  // Quick action pills
  const quickActions = [
    { label: 'Make Request', icon: '📝' },
    { label: 'Perform Approval', icon: '✅' },
    { label: 'Check Status', icon: '🔍' },
    { label: 'View Access', icon: '🔑' },
    { label: 'Help', icon: '❓' }
  ];

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
      height: size.height
    });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle mouse move (dragging and resizing)
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Handle dragging
      if (isDragging && !isDocked && !isFullscreen) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Constrain to viewport
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }

      // Handle resizing
      if (isResizing && !isDocked && !isFullscreen) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = position.x;
        let newY = position.y;

        // Apply changes based on resize direction
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(300, resizeStart.width + deltaX);
        }
        if (resizeDirection.includes('w')) {
          newWidth = Math.max(300, resizeStart.width - deltaX);
          newX = position.x + (resizeStart.width - newWidth);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(400, resizeStart.height + deltaY);
        }
        if (resizeDirection.includes('n')) {
          newHeight = Math.max(400, resizeStart.height - deltaY);
          newY = position.y + (resizeStart.height - newHeight);
        }

        setSize({ width: newWidth, height: newHeight });
        if (newX !== position.x || newY !== position.y) {
          setPosition({ x: newX, y: newY });
        }
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
  }, [isDragging, isResizing, dragOffset, isDocked, isFullscreen, resizeDirection, resizeStart, position, size]);

  // Simulated agent responses
  const getAgentResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('request') || lowerMessage.includes('access')) {
      return "I can help you create an access request. To proceed, I'll need to know:\n\n1. Which resource do you need access to?\n2. What level of access do you require?\n3. Business justification for this request\n\nWould you like to create a new access request now?";
    } else if (lowerMessage.includes('approval') || lowerMessage.includes('approve')) {
      return "You currently have 3 pending approvals waiting for your review:\n\n1. Sarah Johnson - SAP Finance Access (Requested 2 hours ago)\n2. Michael Brown - HR Portal Admin (Requested 1 day ago)\n3. Jennifer Davis - VPN Access (Requested 2 days ago)\n\nWould you like to review and approve/deny any of these requests?";
    } else if (lowerMessage.includes('status') || lowerMessage.includes('check')) {
      return "I can check the status of your recent activities:\n\n• Last access request: Approved (2 days ago)\n• Pending requests: 1 awaiting manager approval\n• Active assignments: 12 roles currently assigned\n• Recent activity: 5 events in the last 24 hours\n\nWould you like more details on any of these?";
    } else if (lowerMessage.includes('view') || lowerMessage.includes('my access')) {
      return "Based on your current permissions, you have access to:\n\n• Finance Applications (SAP, Oracle)\n• HR Systems (Read-only)\n• Project Management Tools\n• Email & Collaboration Suite\n• VPN Access (Standard)\n\nYour access will be reviewed on March 15, 2026. Would you like to request additional access?";
    } else if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      return "I can assist you with:\n\n• Creating access requests\n• Reviewing and approving requests\n• Checking status of requests\n• Viewing your current access rights\n• Searching for identities\n• Generating reports\n• Answering questions about policies\n\nJust tell me what you need, and I'll guide you through the process!";
    } else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      return "You're welcome! Feel free to reach out anytime you need assistance. Have a great day! 😊";
    } else {
      return `I understand you're asking about "${userMessage}". While I can help with access requests, approvals, and identity management tasks, I'd need more specific information to assist you properly.\n\nTry asking about:\n• Making a new access request\n• Checking approval status\n• Viewing your access rights\n• Or type "help" to see all available options`;
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate agent typing delay
    setTimeout(() => {
      const agentResponse = {
        id: messages.length + 2,
        type: 'agent',
        text: getAgentResponse(inputValue),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (action) => {
    setInputValue(action.label);
    inputRef.current?.focus();
  };

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
        style={{ cursor: isDocked ? 'default' : 'move' }}
      >
        <div className="agent-header-content">
          <div className="agent-avatar">👾</div>
          <div className="agent-info">
            <h3>RoZiBoT</h3>
            <span className="agent-status">
              <span className="status-dot"></span>
              Online
            </span>
          </div>
        </div>
        <div className="header-actions">
          {!isDocked && (
            <button
              className="fullscreen-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <span className="icon-text">{isFullscreen ? '↙' : '↗'}</span>
            </button>
          )}
          <button
            className="undock-btn"
            onClick={onToggleDock}
            title={isDocked ? 'Undock window' : 'Dock window'}
          >
            <span className="icon-text">{isDocked ? '◧' : '⬇'}</span>
          </button>
          <button className="agent-close-btn" onClick={onClose} title="Close chat">
            <span className="icon-text">×</span>
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
          >
            <span className="pill-icon">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="agent-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            {message.type === 'agent' && (
              <div className="message-avatar">👾</div>
            )}
            <div className="message-content">
              <div className="message-bubble">
                {message.text.split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    <br />
                  </span>
                ))}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
            {message.type === 'user' && (
              <div className="message-avatar user-avatar">👤</div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="message agent">
            <div className="message-avatar">👾</div>
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
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
        />
        <button
          className="agent-send-btn"
          onClick={handleSendMessage}
          disabled={!inputValue.trim()}
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
