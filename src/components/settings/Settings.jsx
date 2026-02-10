/**
 * Settings Page
 * Tabbed interface for bearer token management and user preferences
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import DashboardLayoutTab from './DashboardLayoutTab';
import './Settings.css';

const Settings = () => {
  const { getBearerToken, getAccessToken } = useAuth();
  const { preferences, setPreference } = usePreferences();
  const [activeTab, setActiveTab] = useState('token');

  // Token management state
  const [currentToken, setCurrentToken] = useState('');
  const [decodedToken, setDecodedToken] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // User preferences state
  const [selectedLocale, setSelectedLocale] = useState(preferences.locale || 'en-US');
  const [selectedTimezone, setSelectedTimezone] = useState(preferences.timezone || 'America/New_York');
  const [welcomeAnimationSpeed, setWelcomeAnimationSpeed] = useState(preferences.welcomeAnimationSpeed || 5000);
  const [dashboardTileLayout, setDashboardTileLayout] = useState(preferences.dashboardTileLayout || 'horizontal');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Debugging preferences state
  const [debugEnablePolicyAnalysis, setDebugEnablePolicyAnalysis] = useState(preferences.debugEnablePolicyAnalysis ?? true);
  const [debugEnableApiConsoleLogging, setDebugEnableApiConsoleLogging] = useState(preferences.debugEnableApiConsoleLogging ?? true);
  const [debugEnableAccessLensLogging, setDebugEnableAccessLensLogging] = useState(preferences.debugEnableAccessLensLogging ?? false);
  const [debugSaveSuccess, setDebugSaveSuccess] = useState(false);

  // Identity360 preferences state
  const [identity360LanesCollapsedOnLoad, setIdentity360LanesCollapsedOnLoad] = useState(preferences.identity360LanesCollapsedOnLoad ?? true);
  const [identity360CollapseLanesOnFocusChange, setIdentity360CollapseLanesOnFocusChange] = useState(preferences.identity360CollapseLanesOnFocusChange ?? true);
  const [identity360ShowDisabledAssignments, setIdentity360ShowDisabledAssignments] = useState(preferences.identity360ShowDisabledAssignments ?? true);
  const [identity360SaveSuccess, setIdentity360SaveSuccess] = useState(false);

  // Color palette state - Omada Brand Aligned
  const defaultColorPalette = {
    // Focus Node Card - Primary Blue gradient
    focusCardBackground: '#005EB8',
    focusCardText: '#ffffff',
    // Access Card Headers - Primary Blue
    cardHeaderBackground: '#005EB8',
    cardHeaderText: '#ffffff',
    cardBorder: '#D1D5DB',
    cardContentBackground: '#ffffff',
    // Lane Items - White background with dark text
    laneItemBackground: '#ffffff',
    laneItemBackgroundHover: '#EBF5FF',
    laneItemTitle: '#2C3E50',
    laneItemText: '#2C3E50',
    // Selection - Light blue highlight
    laneItemSelectedBackground: '#EBF5FF',
    laneItemSelectedBorder: '#005EB8',
    // Pills/Badges - Accent Teal
    pillBackground: '#00B4D8',
    pillText: '#ffffff',
    // Filter States - Primary Blue for source
    filterSourceBackground: '#005EB8',
    filterSourceGlow: '#00B4D8',
    filteredBackground: '#64748B',  // Slate gray - easier on eyes
    // Violations - Error Red
    violationsBackground: '#EF4444',
    violationsText: '#ffffff',
    // Count Badge
    countBadgeColor: '#ffffff',
    // Status Colors (semantic)
    statusApproved: '#10B981',
    statusNotApproved: '#EF4444',
    statusPending: '#F59E0B',
    statusInherited: '#00B4D8',
    // Neutral Grays
    lightGray: '#F3F4F6',
    mediumGray: '#E5E7EB',
    borderGray: '#D1D5DB',
    darkNeutral: '#2C3E50'
  };
  const [colorPalette, setColorPalette] = useState(preferences.colorPalette || defaultColorPalette);
  const [colorPaletteSaveSuccess, setColorPaletteSaveSuccess] = useState(false);

  useEffect(() => {
    loadCurrentToken();
  }, []);

  const loadCurrentToken = () => {
    // Check for override token first
    const overrideToken = localStorage.getItem('bearer_token_override');
    const token = overrideToken || getAccessToken();
    setCurrentToken(token || '');

    if (token) {
      const decoded = decodeJWT(token);
      setDecodedToken(decoded);
    }
  };

  // Decode JWT token
  const decodeJWT = (token) => {
    try {
      // JWT has 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { error: 'Invalid JWT format - must have 3 parts' };
      }

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      // Decode the header (first part)
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));

      return {
        header,
        payload,
        signature: parts[2]
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return { error: error.message };
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const isTokenExpired = (exp) => {
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  };

  const getTimeRemaining = (exp) => {
    if (!exp) return 'N/A';
    const now = Date.now();
    const expTime = exp * 1000;
    const diff = expTime - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleSaveToken = () => {
    if (!newToken.trim()) {
      alert('Please enter a token');
      return;
    }

    // Validate token format
    const decoded = decodeJWT(newToken.trim());
    if (decoded.error) {
      alert(`Invalid token: ${decoded.error}`);
      return;
    }

    // Save override token
    localStorage.setItem('bearer_token_override', newToken.trim());

    // Reload the token
    loadCurrentToken();
    setIsEditing(false);
    setNewToken('');

    alert('Bearer token updated successfully!\n\nAll future API calls will use this token.');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewToken('');
  };

  const handleResetToOriginal = () => {
    if (window.confirm('Reset to original OAuth token? This will remove the override token.')) {
      localStorage.removeItem('bearer_token_override');
      loadCurrentToken();
      alert('Token reset to original OAuth token');
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(currentToken);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSavePreferences = () => {
    setPreference('locale', selectedLocale);
    setPreference('timezone', selectedTimezone);
    setPreference('welcomeAnimationSpeed', welcomeAnimationSpeed);
    setPreference('dashboardTileLayout', dashboardTileLayout);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSaveDebuggingPreferences = () => {
    setPreference('debugEnablePolicyAnalysis', debugEnablePolicyAnalysis);
    setPreference('debugEnableApiConsoleLogging', debugEnableApiConsoleLogging);
    setPreference('debugEnableAccessLensLogging', debugEnableAccessLensLogging);

    // Update the apiLogger's console logging setting immediately
    if (window.__apiLoggerInstance) {
      window.__apiLoggerInstance.setConsoleLogging(debugEnableApiConsoleLogging);
    }

    setDebugSaveSuccess(true);
    setTimeout(() => setDebugSaveSuccess(false), 2000);
  };

  const handleSaveIdentity360Preferences = () => {
    setPreference('identity360LanesCollapsedOnLoad', identity360LanesCollapsedOnLoad);
    setPreference('identity360CollapseLanesOnFocusChange', identity360CollapseLanesOnFocusChange);
    setPreference('identity360ShowDisabledAssignments', identity360ShowDisabledAssignments);

    setIdentity360SaveSuccess(true);
    setTimeout(() => setIdentity360SaveSuccess(false), 2000);
  };

  const handleSaveColorPalette = () => {
    setPreference('colorPalette', colorPalette);
    setColorPaletteSaveSuccess(true);
    setTimeout(() => setColorPaletteSaveSuccess(false), 2000);
  };

  const handleResetColorPalette = () => {
    setColorPalette(defaultColorPalette);
  };

  const updateColor = (key, value) => {
    setColorPalette(prev => ({ ...prev, [key]: value }));
  };

  const isOverridden = !!localStorage.getItem('bearer_token_override');

  // Available locales
  const locales = [
    { value: 'en-US', label: 'English (United States)' },
    { value: 'en-GB', label: 'English (United Kingdom)' },
    { value: 'en-CA', label: 'English (Canada)' },
    { value: 'en-AU', label: 'English (Australia)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'fr-CA', label: 'French (Canada)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'es-ES', label: 'Spanish (Spain)' },
    { value: 'es-MX', label: 'Spanish (Mexico)' },
    { value: 'it-IT', label: 'Italian (Italy)' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'pt-PT', label: 'Portuguese (Portugal)' },
    { value: 'nl-NL', label: 'Dutch (Netherlands)' },
    { value: 'ja-JP', label: 'Japanese (Japan)' },
    { value: 'zh-CN', label: 'Chinese (Simplified)' },
    { value: 'zh-TW', label: 'Chinese (Traditional)' },
    { value: 'ko-KR', label: 'Korean (Korea)' },
    { value: 'ru-RU', label: 'Russian (Russia)' },
    { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
    { value: 'hi-IN', label: 'Hindi (India)' }
  ];

  // Available timezones
  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'token' ? 'active' : ''}`}
          onClick={() => setActiveTab('token')}
        >
          🔑 Token Management
        </button>
        <button
          className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          👤 User Preferences
        </button>
        <button
          className={`tab-button ${activeTab === 'layout' ? 'active' : ''}`}
          onClick={() => setActiveTab('layout')}
        >
          📊 Dashboard Layout
        </button>
        <button
          className={`tab-button ${activeTab === 'debugging' ? 'active' : ''}`}
          onClick={() => setActiveTab('debugging')}
        >
          🐛 Debugging
        </button>
        <button
          className={`tab-button ${activeTab === 'identity360' ? 'active' : ''}`}
          onClick={() => setActiveTab('identity360')}
        >
          🔍 Identity360
        </button>
        <button
          className={`tab-button ${activeTab === 'colorPalette' ? 'active' : ''}`}
          onClick={() => setActiveTab('colorPalette')}
        >
          🎨 Color Palette
        </button>
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {/* Token Management Tab */}
        {activeTab === 'token' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Bearer Token Management</h2>
              {isOverridden && (
                <span className="override-badge">OVERRIDDEN</span>
              )}
            </div>

            {/* Current Token Display */}
            <div className="token-display-section">
              <h3>Current Bearer Token</h3>
              <div className="token-box">
                <code className="token-value">{currentToken || 'No token available'}</code>
                {currentToken && (
                  <button className="btn-copy" onClick={handleCopyToken}>
                    {copySuccess ? '✓ Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {isOverridden && (
                <div className="override-notice">
                  <p>⚠️ You are using a manually overridden token.</p>
                  <button onClick={handleResetToOriginal} className="btn btn-warning">
                    Reset to Original OAuth Token
                  </button>
                </div>
              )}
            </div>

            {/* Token Analysis */}
            {decodedToken && !decodedToken.error && (
              <div className="token-analysis">
                <h3>Token Analysis</h3>

                {/* Token Status */}
                <div className="token-status">
                  <div className={`status-indicator ${isTokenExpired(decodedToken.payload.exp) ? 'expired' : 'valid'}`}>
                    {isTokenExpired(decodedToken.payload.exp) ? '❌ EXPIRED' : '✅ VALID'}
                  </div>
                  {!isTokenExpired(decodedToken.payload.exp) && (
                    <div className="time-remaining">
                      Expires in: {getTimeRemaining(decodedToken.payload.exp)}
                    </div>
                  )}
                </div>

                {/* Header */}
                <div className="token-section">
                  <h4>Header</h4>
                  <div className="token-claims">
                    <div className="claim-item">
                      <span className="claim-label">Algorithm:</span>
                      <span className="claim-value">{decodedToken.header.alg || 'N/A'}</span>
                    </div>
                    <div className="claim-item">
                      <span className="claim-label">Type:</span>
                      <span className="claim-value">{decodedToken.header.typ || 'N/A'}</span>
                    </div>
                    {decodedToken.header.kid && (
                      <div className="claim-item">
                        <span className="claim-label">Key ID:</span>
                        <span className="claim-value mono">{decodedToken.header.kid}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payload - Key Claims */}
                <div className="token-section">
                  <h4>Key Claims</h4>
                  <div className="token-claims">
                    {decodedToken.payload.sub && (
                      <div className="claim-item">
                        <span className="claim-label">Subject (sub):</span>
                        <span className="claim-value">{decodedToken.payload.sub}</span>
                      </div>
                    )}
                    {decodedToken.payload.iss && (
                      <div className="claim-item">
                        <span className="claim-label">Issuer (iss):</span>
                        <span className="claim-value">{decodedToken.payload.iss}</span>
                      </div>
                    )}
                    {decodedToken.payload.aud && (
                      <div className="claim-item">
                        <span className="claim-label">Audience (aud):</span>
                        <span className="claim-value">{decodedToken.payload.aud}</span>
                      </div>
                    )}
                    {decodedToken.payload.azp && (
                      <div className="claim-item">
                        <span className="claim-label">Authorized Party (azp):</span>
                        <span className="claim-value">{decodedToken.payload.azp}</span>
                      </div>
                    )}
                    {decodedToken.payload.exp && (
                      <div className="claim-item">
                        <span className="claim-label">Expires At (exp):</span>
                        <span className="claim-value">{formatDate(decodedToken.payload.exp)}</span>
                      </div>
                    )}
                    {decodedToken.payload.iat && (
                      <div className="claim-item">
                        <span className="claim-label">Issued At (iat):</span>
                        <span className="claim-value">{formatDate(decodedToken.payload.iat)}</span>
                      </div>
                    )}
                    {decodedToken.payload.nbf && (
                      <div className="claim-item">
                        <span className="claim-label">Not Before (nbf):</span>
                        <span className="claim-value">{formatDate(decodedToken.payload.nbf)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* All Claims */}
                <div className="token-section">
                  <h4>All Claims (Payload)</h4>
                  <pre className="json-display">{JSON.stringify(decodedToken.payload, null, 2)}</pre>
                </div>
              </div>
            )}

            {decodedToken && decodedToken.error && (
              <div className="error-message">
                <p>Error decoding token: {decodedToken.error}</p>
              </div>
            )}

            {/* Edit Token Section */}
            <div className="token-edit-section">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="btn btn-primary">
                  Replace Bearer Token
                </button>
              ) : (
                <div className="token-edit-form">
                  <h3>Enter New Bearer Token</h3>
                  <p className="edit-instruction">
                    Paste your new bearer token below. This will override the current token for all API calls.
                  </p>
                  <textarea
                    className="token-input"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="Paste bearer token here (without 'Bearer ' prefix)..."
                    rows={6}
                  />
                  <div className="edit-actions">
                    <button onClick={handleSaveToken} className="btn btn-primary">
                      Save Token
                    </button>
                    <button onClick={handleCancelEdit} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* User Preferences Tab */}
        {activeTab === 'preferences' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>User Preferences</h2>
            </div>

            <div className="preferences-form">
              {/* Locale Selection */}
              <div className="form-group">
                <label htmlFor="locale-select">
                  <span className="label-icon">🌐</span>
                  Locale / Language
                </label>
                <p className="form-description">
                  Select your preferred language and regional format for dates, numbers, and text.
                </p>
                <select
                  id="locale-select"
                  className="form-select"
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value)}
                >
                  {locales.map(locale => (
                    <option key={locale.value} value={locale.value}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timezone Selection */}
              <div className="form-group">
                <label htmlFor="timezone-select">
                  <span className="label-icon">🕐</span>
                  Timezone
                </label>
                <p className="form-description">
                  Select your timezone. All dates and times will be displayed in this timezone.
                </p>
                <select
                  id="timezone-select"
                  className="form-select"
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                >
                  {timezones.map(timezone => (
                    <option key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Welcome Animation Speed */}
              <div className="form-group">
                <label htmlFor="welcome-speed-select">
                  <span className="label-icon">🎭</span>
                  Welcome Animation Speed
                </label>
                <p className="form-description">
                  Control how fast the welcome message cycles through different languages on the home page.
                </p>
                <select
                  id="welcome-speed-select"
                  className="form-select"
                  value={welcomeAnimationSpeed}
                  onChange={(e) => setWelcomeAnimationSpeed(Number(e.target.value))}
                >
                  <option value={0}>Disabled (no animation)</option>
                  <option value={3000}>Fast (3 seconds)</option>
                  <option value={5000}>Normal (5 seconds)</option>
                  <option value={7000}>Slow (7 seconds)</option>
                  <option value={10000}>Very Slow (10 seconds)</option>
                </select>
              </div>

              {/* Dashboard Tile Layout */}
              <div className="form-group">
                <label htmlFor="tile-layout-select">
                  <span className="label-icon">📊</span>
                  Dashboard Tile Layout
                </label>
                <p className="form-description">
                  Choose how tiles are displayed on the dashboard home page.
                </p>
                <select
                  id="tile-layout-select"
                  className="form-select"
                  value={dashboardTileLayout}
                  onChange={(e) => setDashboardTileLayout(e.target.value)}
                >
                  <option value="horizontal">Horizontal (side by side)</option>
                  <option value="vertical">Vertical (stacked)</option>
                </select>
              </div>

              {/* Current Settings Display */}
              <div className="current-settings">
                <h3>Current Settings</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <span className="setting-label">Locale:</span>
                    <span className="setting-value">{selectedLocale}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Timezone:</span>
                    <span className="setting-value">{selectedTimezone}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Current Time:</span>
                    <span className="setting-value">
                      {new Date().toLocaleString(selectedLocale, { timeZone: selectedTimezone })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="form-actions">
                <button
                  onClick={handleSavePreferences}
                  className={`btn btn-primary ${saveSuccess ? 'success' : ''}`}
                >
                  {saveSuccess ? '✓ Preferences Saved!' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Dashboard Layout Tab */}
        {activeTab === 'layout' && <DashboardLayoutTab />}

        {/* Debugging Tab */}
        {activeTab === 'debugging' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Debugging Options</h2>
            </div>

            <div className="preferences-form">
              {/* Policy Analysis Debug Helper */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={debugEnablePolicyAnalysis}
                    onChange={(e) => setDebugEnablePolicyAnalysis(e.target.checked)}
                  />
                  <span className="label-icon">🔍</span>
                  Enable Policy Analysis Debug Helper
                </label>
                <p className="form-description">
                  When enabled, exposes <code>window.policyAnalysis</code> in the browser console on the Identity360 page.
                  This allows you to analyze which identities have entitlements assigned by multiple policies.
                  <br /><br />
                  <strong>Usage:</strong> Open browser console and type <code>window.policyAnalysis.help()</code>
                </p>
              </div>

              {/* API Console Logging */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={debugEnableApiConsoleLogging}
                    onChange={(e) => setDebugEnableApiConsoleLogging(e.target.checked)}
                  />
                  <span className="label-icon">📡</span>
                  Log OData &amp; GraphQL API Calls to Console
                </label>
                <p className="form-description">
                  When enabled, logs all OData and GraphQL API requests and responses to the browser console
                  with colored badges showing request/response status.
                  <br /><br />
                  <strong>Note:</strong> Useful for debugging API issues but can clutter the console during normal use.
                </p>
              </div>

              {/* Identity360 Verbose Logging */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={debugEnableAccessLensLogging}
                    onChange={(e) => setDebugEnableAccessLensLogging(e.target.checked)}
                  />
                  <span className="label-icon">🔬</span>
                  Enable Identity360 Verbose Logging
                </label>
                <p className="form-description">
                  When enabled, outputs detailed logging for the Identity360 component including
                  lane building, data transformations, and filtering operations.
                  <br /><br />
                  <strong>Warning:</strong> This generates a lot of console output and may impact performance.
                </p>
              </div>

              {/* Current Debug Status */}
              <div className="current-settings">
                <h3>Current Debug Status</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <span className="setting-label">Policy Analysis:</span>
                    <span className={`setting-value ${debugEnablePolicyAnalysis ? 'enabled' : 'disabled'}`}>
                      {debugEnablePolicyAnalysis ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">API Console Logging:</span>
                    <span className={`setting-value ${debugEnableApiConsoleLogging ? 'enabled' : 'disabled'}`}>
                      {debugEnableApiConsoleLogging ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Identity360 Logging:</span>
                    <span className={`setting-value ${debugEnableAccessLensLogging ? 'enabled' : 'disabled'}`}>
                      {debugEnableAccessLensLogging ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="form-actions">
                <button
                  onClick={handleSaveDebuggingPreferences}
                  className={`btn btn-primary ${debugSaveSuccess ? 'success' : ''}`}
                >
                  {debugSaveSuccess ? '✓ Settings Saved!' : 'Save Debug Settings'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Identity360 Tab */}
        {activeTab === 'identity360' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Identity360 Display Settings</h2>
            </div>

            <div className="preferences-form">
              <p className="section-description">
                Configure how the Identity360 visualization displays access cards (lanes) when loading or changing the focus identity.
              </p>

              <div className="preference-group">
                <h3>Access Card Display</h3>

                <label className="preference-item checkbox-item">
                  <input
                    type="checkbox"
                    checked={identity360LanesCollapsedOnLoad}
                    onChange={(e) => setIdentity360LanesCollapsedOnLoad(e.target.checked)}
                  />
                  <div className="preference-text">
                    <span className="preference-label">Start with access cards collapsed</span>
                    <span className="preference-description">
                      When Identity360 first loads, all access cards (lanes) will be minimized. You can expand individual cards as needed.
                    </span>
                  </div>
                </label>

                <label className="preference-item checkbox-item">
                  <input
                    type="checkbox"
                    checked={identity360CollapseLanesOnFocusChange}
                    onChange={(e) => setIdentity360CollapseLanesOnFocusChange(e.target.checked)}
                  />
                  <div className="preference-text">
                    <span className="preference-label">Collapse access cards when changing identity</span>
                    <span className="preference-description">
                      When switching to a different focus identity (via search or pivot), automatically collapse all access cards.
                    </span>
                  </div>
                </label>
              </div>

              <div className="preference-group">
                <h3>Data Filtering</h3>

                <label className="preference-item checkbox-item">
                  <input
                    type="checkbox"
                    checked={identity360ShowDisabledAssignments}
                    onChange={(e) => setIdentity360ShowDisabledAssignments(e.target.checked)}
                  />
                  <div className="preference-text">
                    <span className="preference-label">Include disabled assignments</span>
                    <span className="preference-description">
                      Show disabled/inactive assignments in Identity360 results. When enabled, both active and disabled assignments are displayed.
                    </span>
                  </div>
                </label>
              </div>

              {/* Current Settings Display */}
              <div className="current-settings">
                <h3>Current Settings</h3>
                <div className="settings-summary">
                  <div className="setting-item">
                    <span className="setting-label">Cards collapsed on load:</span>
                    <span className={`setting-value ${identity360LanesCollapsedOnLoad ? 'enabled' : 'disabled'}`}>
                      {identity360LanesCollapsedOnLoad ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Collapse on identity change:</span>
                    <span className={`setting-value ${identity360CollapseLanesOnFocusChange ? 'enabled' : 'disabled'}`}>
                      {identity360CollapseLanesOnFocusChange ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Include disabled assignments:</span>
                    <span className={`setting-value ${identity360ShowDisabledAssignments ? 'enabled' : 'disabled'}`}>
                      {identity360ShowDisabledAssignments ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  onClick={handleSaveIdentity360Preferences}
                  className={`btn btn-primary ${identity360SaveSuccess ? 'success' : ''}`}
                >
                  {identity360SaveSuccess ? '✓ Settings Saved!' : 'Save Identity360 Settings'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Color Palette Tab */}
        {activeTab === 'colorPalette' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Identity360 Color Palette</h2>
            </div>

            <div className="preferences-form">
              <p className="form-description" style={{ marginBottom: '1.5rem' }}>
                Customize the colors used in the Identity360 dashboard. Changes apply to the light theme.
              </p>

              {/* Focus Node Card */}
              <div className="color-group">
                <h3>Focus Node Card</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Background</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.focusCardBackground}
                        onChange={(e) => updateColor('focusCardBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.focusCardBackground}
                        onChange={(e) => updateColor('focusCardBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Text</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.focusCardText}
                        onChange={(e) => updateColor('focusCardText', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.focusCardText}
                        onChange={(e) => updateColor('focusCardText', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Card Header */}
              <div className="color-group">
                <h3>Access Card Header</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Background</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.cardHeaderBackground}
                        onChange={(e) => updateColor('cardHeaderBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.cardHeaderBackground}
                        onChange={(e) => updateColor('cardHeaderBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Text</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.cardHeaderText}
                        onChange={(e) => updateColor('cardHeaderText', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.cardHeaderText}
                        onChange={(e) => updateColor('cardHeaderText', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Border</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.cardBorder}
                        onChange={(e) => updateColor('cardBorder', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.cardBorder}
                        onChange={(e) => updateColor('cardBorder', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Count Badge</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.countBadgeColor}
                        onChange={(e) => updateColor('countBadgeColor', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.countBadgeColor}
                        onChange={(e) => updateColor('countBadgeColor', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lane Items */}
              <div className="color-group">
                <h3>Lane Items</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Background</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.laneItemBackground}
                        onChange={(e) => updateColor('laneItemBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.laneItemBackground}
                        onChange={(e) => updateColor('laneItemBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Hover</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.laneItemBackgroundHover}
                        onChange={(e) => updateColor('laneItemBackgroundHover', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.laneItemBackgroundHover}
                        onChange={(e) => updateColor('laneItemBackgroundHover', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Title Text</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.laneItemTitle}
                        onChange={(e) => updateColor('laneItemTitle', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.laneItemTitle}
                        onChange={(e) => updateColor('laneItemTitle', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Text</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.laneItemText}
                        onChange={(e) => updateColor('laneItemText', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.laneItemText}
                        onChange={(e) => updateColor('laneItemText', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Selection */}
              <div className="color-group">
                <h3>Selection State</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Selected Background</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.laneItemSelectedBackground}
                        onChange={(e) => updateColor('laneItemSelectedBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.laneItemSelectedBackground}
                        onChange={(e) => updateColor('laneItemSelectedBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Selected Border</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.laneItemSelectedBorder}
                        onChange={(e) => updateColor('laneItemSelectedBorder', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.laneItemSelectedBorder}
                        onChange={(e) => updateColor('laneItemSelectedBorder', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pills/Badges */}
              <div className="color-group">
                <h3>Pills / Badges</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Background</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.pillBackground}
                        onChange={(e) => updateColor('pillBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.pillBackground}
                        onChange={(e) => updateColor('pillBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Text</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.pillText}
                        onChange={(e) => updateColor('pillText', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.pillText}
                        onChange={(e) => updateColor('pillText', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter States */}
              <div className="color-group">
                <h3>Filter States</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Filter Source</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.filterSourceBackground}
                        onChange={(e) => updateColor('filterSourceBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.filterSourceBackground}
                        onChange={(e) => updateColor('filterSourceBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Filter Glow</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.filterSourceGlow}
                        onChange={(e) => updateColor('filterSourceGlow', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.filterSourceGlow}
                        onChange={(e) => updateColor('filterSourceGlow', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Filtered State</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.filteredBackground}
                        onChange={(e) => updateColor('filteredBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.filteredBackground}
                        onChange={(e) => updateColor('filteredBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Violations */}
              <div className="color-group">
                <h3>Violations Lane</h3>
                <div className="color-grid">
                  <div className="color-item">
                    <label>Background</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.violationsBackground}
                        onChange={(e) => updateColor('violationsBackground', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.violationsBackground}
                        onChange={(e) => updateColor('violationsBackground', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                  <div className="color-item">
                    <label>Text</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={colorPalette.violationsText}
                        onChange={(e) => updateColor('violationsText', e.target.value)}
                      />
                      <input
                        type="text"
                        value={colorPalette.violationsText}
                        onChange={(e) => updateColor('violationsText', e.target.value)}
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="form-actions">
                <button
                  onClick={handleSaveColorPalette}
                  className={`btn btn-primary ${colorPaletteSaveSuccess ? 'success' : ''}`}
                >
                  {colorPaletteSaveSuccess ? '✓ Colors Saved!' : 'Save Color Palette'}
                </button>
                <button
                  onClick={handleResetColorPalette}
                  className="btn btn-secondary"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;
