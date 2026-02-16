/**
 * IdentitySearchDialog Component
 * Modal dialog with instant client-side type-ahead search and OrgUnit multi-select
 * dropdown for selecting an identity to view in Identity360.
 *
 * IMPORTANT: Uses UId (32-character GUID) for identity selection, NOT Id or IdentityID
 * The UId is required for getIdentityContexts and getCalculatedAssignmentsDetailed APIs
 *
 * Search strategy:
 *  - On first open: loads ALL identities via OData (with select fields), cached for session
 *  - Type-ahead: instant client-side filtering across name/email/employeeId fields
 *  - Active identities only (client-side — Omada OData doesn't support function filters)
 *  - OrgUnit dropdown extracted from cached data
 *  - Subsequent dialog opens reuse the cache (instant)
 *
 * NOTE: Omada OData does NOT support contains(), tolower(), or navigation property
 * filters (e.g. IDENTITYSTATUS/DisplayName). All filtering must be client-side.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { omadaApi } from '../../services/omadaApi';
import './IdentitySearchDialog.css';

const MIN_SEARCH_CHARS = 2;
const MAX_DISPLAY_RESULTS = 50;
const IDENTITY_SELECT_FIELDS = 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL';

// Module-level cache — persists across dialog opens within the same session
let cachedIdentities = null;
let cachedOrgUnits = null;

/**
 * Check if an identity is active (client-side filter).
 * IDENTITYSTATUS comes back as an object { DisplayName, Id } or a string.
 * Omada OData does not support server-side filtering on this field.
 */
const isActiveIdentity = (identity) => {
  const status = identity.IDENTITYSTATUS;
  if (!status) return true;
  if (typeof status === 'string') return status.toLowerCase() === 'active';
  if (typeof status === 'object') {
    const s = status.DisplayName || status.Value || status.Name || status.KeyValue || '';
    return s.toLowerCase() === 'active';
  }
  return true;
};

/** Extract the OrgUnit display string from an identity's OUREF field */
const getOrgUnitString = (identity) => {
  const ou = identity?.OUREF;
  if (!ou) return null;
  if (typeof ou === 'string') return ou;
  return ou.DisplayName || ou.Value || null;
};

const IdentitySearchDialog = ({ isOpen, onClose, onSelectIdentity }) => {
  const { getBearerToken, user } = useAuth();

  // Search & results
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);

  // All identities (from cache or freshly loaded)
  const [allIdentities, setAllIdentities] = useState(cachedIdentities || []);
  const [orgUnits, setOrgUnits] = useState(cachedOrgUnits || []);

  // OrgUnit multi-select
  const [selectedOrgUnits, setSelectedOrgUnits] = useState(new Set());
  const [isOuDropdownOpen, setIsOuDropdownOpen] = useState(false);
  const [ouFilterText, setOuFilterText] = useState('');

  // Refs
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const ouDropdownRef = useRef(null);
  const canCloseRef = useRef(false);

  // ── On open: load identities (from cache or server) ────────────────
  useEffect(() => {
    if (isOpen) {
      canCloseRef.current = false;
      const timer = setTimeout(() => { canCloseRef.current = true; }, 500);

      if (!cachedIdentities) {
        loadAllIdentities();
      }
      setIsDropdownOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);

      return () => clearTimeout(timer);
    } else {
      resetState();
    }
  }, [isOpen]);

  // ── Close OU dropdown on outside click ─────────────────────────────
  useEffect(() => {
    if (!isOuDropdownOpen) return;
    const handleClick = (e) => {
      if (ouDropdownRef.current && !ouDropdownRef.current.contains(e.target)) {
        setIsOuDropdownOpen(false);
        setOuFilterText('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOuDropdownOpen]);

  // ── Escape key ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && canCloseRef.current) {
        if (isOuDropdownOpen) {
          setIsOuDropdownOpen(false);
          setOuFilterText('');
        } else {
          handleClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isOuDropdownOpen]);

  // ── Load all identities (one-time, cached for session) ─────────────
  const loadAllIdentities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      const result = await omadaApi.identity.searchIdentities(
        null, bearerToken, impersonateUser,
        {
          top: 10000,
          select: IDENTITY_SELECT_FIELDS,
          orderBy: 'LASTNAME,FIRSTNAME'
        }
      );

      if (result.status === 'success' && result.data) {
        // Filter to active identities only
        const activeIdentities = result.data.filter(isActiveIdentity);

        // Extract unique OrgUnits
        const ouSet = new Set();
        activeIdentities.forEach(row => {
          const ou = getOrgUnitString(row);
          if (ou) ouSet.add(ou);
        });
        const sortedOrgUnits = Array.from(ouSet).sort();

        // Cache for session
        cachedIdentities = activeIdentities;
        cachedOrgUnits = sortedOrgUnits;

        setAllIdentities(activeIdentities);
        setOrgUnits(sortedOrgUnits);
      } else {
        setError('Failed to load identities');
      }
    } catch (err) {
      console.error('Error loading identities:', err);
      setError(err.message || 'Failed to load identities');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Client-side filtering (instant) ────────────────────────────────
  const filteredIdentities = useMemo(() => {
    if (selectedIdentity) return [];

    let filtered = allIdentities;

    // OrgUnit filter
    if (selectedOrgUnits.size > 0) {
      filtered = filtered.filter(identity => {
        const ou = getOrgUnitString(identity);
        return ou && selectedOrgUnits.has(ou);
      });
    }

    // Text search filter
    const query = searchQuery.trim().toLowerCase();
    if (query.length >= MIN_SEARCH_CHARS) {
      filtered = filtered.filter(identity => {
        const displayName = (identity.DISPLAYNAME || '').toLowerCase();
        const firstName = (identity.FIRSTNAME || '').toLowerCase();
        const lastName = (identity.LASTNAME || '').toLowerCase();
        const email = (identity.EMAIL || '').toLowerCase();
        const empId = (identity.EMPLOYEEID || '').toLowerCase();
        return displayName.includes(query) ||
               firstName.includes(query) ||
               lastName.includes(query) ||
               email.includes(query) ||
               empId.includes(query);
      });
    }

    return filtered.slice(0, MAX_DISPLAY_RESULTS);
  }, [allIdentities, searchQuery, selectedOrgUnits, selectedIdentity]);

  // ── OrgUnit multi-select handlers ──────────────────────────────────
  const toggleOrgUnit = (ou) => {
    setSelectedIdentity(null);
    setSelectedOrgUnits(prev => {
      const next = new Set(prev);
      if (next.has(ou)) {
        next.delete(ou);
      } else {
        next.add(ou);
      }
      return next;
    });
    setIsDropdownOpen(true);
  };

  const removeOrgUnit = (ou) => {
    setSelectedIdentity(null);
    setSelectedOrgUnits(prev => {
      const next = new Set(prev);
      next.delete(ou);
      return next;
    });
  };

  const clearOrgUnits = () => {
    setSelectedIdentity(null);
    setSelectedOrgUnits(new Set());
  };

  // ── Identity selection ─────────────────────────────────────────────
  const handleSelect = (identity) => {
    if (!identity.UId) {
      console.error('Identity missing UId (32-char GUID):', identity);
      setError('Selected identity is missing required UId. Please select another.');
      return;
    }
    setSelectedIdentity(identity);
    setSearchQuery(formatDisplayName(identity));
    setIsDropdownOpen(false);
  };

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setSelectedIdentity(null);
    setIsDropdownOpen(true);
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleConfirm = () => {
    if (selectedIdentity?.UId) {
      onSelectIdentity(selectedIdentity);
      handleClose();
    }
  };

  const resetState = () => {
    setSearchQuery('');
    setSelectedIdentity(null);
    setSelectedOrgUnits(new Set());
    setOuFilterText('');
    setIsOuDropdownOpen(false);
    setError(null);
    canCloseRef.current = false;
  };

  const handleClose = () => {
    resetState();
    setIsDropdownOpen(false);
    onClose();
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const formatDisplayName = (identity) => {
    if (identity.DISPLAYNAME) return identity.DISPLAYNAME;
    const firstName = identity.FIRSTNAME || '';
    const lastName = identity.LASTNAME || '';
    if (lastName && firstName) return `${lastName}, ${firstName}`;
    return lastName || firstName || 'Unknown';
  };

  const getInitials = (identity) => {
    if (identity.FIRSTNAME && identity.LASTNAME) {
      return `${identity.FIRSTNAME[0]}${identity.LASTNAME[0]}`.toUpperCase();
    }
    if (identity.DISPLAYNAME) {
      const parts = identity.DISPLAYNAME.split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      return identity.DISPLAYNAME[0].toUpperCase();
    }
    return '?';
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && canCloseRef.current) handleClose();
  };

  // ── Derived state ──────────────────────────────────────────────────
  const hasSearchCriteria = searchQuery.trim().length >= MIN_SEARCH_CHARS || selectedOrgUnits.size > 0;
  const showPrompt = !hasSearchCriteria && filteredIdentities.length === 0 && !isLoading && !error;

  // Filtered list for the OU dropdown search
  const filteredOrgUnits = ouFilterText
    ? orgUnits.filter(ou => ou.toLowerCase().includes(ouFilterText.toLowerCase()))
    : orgUnits;

  const ouSummary = selectedOrgUnits.size === 0
    ? 'All departments'
    : selectedOrgUnits.size === 1
      ? Array.from(selectedOrgUnits)[0]
      : `${selectedOrgUnits.size} departments selected`;

  if (!isOpen) return null;

  return (
    <div className="identity-search-dialog-overlay" onClick={handleOverlayClick}>
      <div className="identity-search-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2>Select Identity</h2>
          <button className="dialog-close-btn" onClick={handleClose}>&times;</button>
        </div>

        {/* Dropdown Container */}
        <div className="dropdown-container">
          <label className="dropdown-label">Search for an active identity by name, email, or employee ID:</label>

          {/* OrgUnit Multi-Select Dropdown */}
          <div className="ou-select-wrapper" ref={ouDropdownRef}>
            <label className="ou-select-label">Department filter:</label>
            <button
              className={`ou-select-trigger ${isOuDropdownOpen ? 'open' : ''} ${selectedOrgUnits.size > 0 ? 'has-selection' : ''}`}
              onClick={() => { setIsOuDropdownOpen(!isOuDropdownOpen); setOuFilterText(''); }}
            >
              <span className="ou-select-text">{ouSummary}</span>
              <span className="ou-select-arrow">{isOuDropdownOpen ? '\u25B2' : '\u25BC'}</span>
            </button>

            {isOuDropdownOpen && (
              <div className="ou-select-dropdown">
                {/* Search within departments */}
                <div className="ou-select-search">
                  <input
                    type="text"
                    className="ou-select-search-input"
                    placeholder="Filter departments..."
                    value={ouFilterText}
                    onChange={(e) => setOuFilterText(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Select all / Clear all */}
                {selectedOrgUnits.size > 0 && (
                  <button className="ou-select-clear" onClick={clearOrgUnits}>
                    Clear all ({selectedOrgUnits.size})
                  </button>
                )}

                {/* Options list */}
                <div className="ou-select-options">
                  {isLoading ? (
                    <div className="ou-select-loading">Loading departments...</div>
                  ) : filteredOrgUnits.length === 0 ? (
                    <div className="ou-select-empty">
                      {ouFilterText ? 'No departments match' : 'No departments available'}
                    </div>
                  ) : (
                    filteredOrgUnits.map(ou => (
                      <label key={ou} className="ou-select-option">
                        <input
                          type="checkbox"
                          checked={selectedOrgUnits.has(ou)}
                          onChange={() => toggleOrgUnit(ou)}
                        />
                        <span className="ou-select-option-text">{ou}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected OrgUnit Tags */}
          {selectedOrgUnits.size > 0 && (
            <div className="ou-selected-tags">
              {Array.from(selectedOrgUnits).map(ou => (
                <span key={ou} className="ou-tag">
                  {ou}
                  <button className="ou-tag-remove" onClick={() => removeOrgUnit(ou)}>&times;</button>
                </span>
              ))}
            </div>
          )}

          {/* Identity Search Input */}
          <div className="dropdown-input-wrapper">
            <svg className="dropdown-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref={inputRef}
              type="text"
              id="identity-search-input"
              name="identity-search-input"
              className="dropdown-input"
              placeholder={`Type at least ${MIN_SEARCH_CHARS} characters to search${selectedOrgUnits.size > 0 ? ' (filtered by dept)' : ''}...`}
              autoComplete="off"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
            />
            {(searchQuery || selectedOrgUnits.size > 0) && (
              <button
                className="dropdown-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedOrgUnits(new Set());
                  setSelectedIdentity(null);
                  inputRef.current?.focus();
                }}
                title="Clear all filters"
              >
                &times;
              </button>
            )}
            <button
              className="dropdown-toggle-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {isDropdownOpen ? '\u25B2' : '\u25BC'}
            </button>
          </div>

          {/* Results Dropdown */}
          {isDropdownOpen && (
            <div className="dropdown-list" ref={dropdownRef}>
              {isLoading ? (
                <div className="dropdown-loading">
                  <div className="dropdown-spinner"></div>
                  <span>Loading identities ({allIdentities.length > 0 ? `${allIdentities.length} loaded...` : '...'})</span>
                </div>
              ) : error ? (
                <div className="dropdown-error">
                  <span className="error-icon">{'\u26A0\uFE0F'}</span>
                  {error}
                </div>
              ) : showPrompt ? (
                <div className="dropdown-empty">
                  <span>Type a name, email, or ID to search{orgUnits.length > 0 ? ' \u2014 or select departments above to filter' : ''}</span>
                </div>
              ) : filteredIdentities.length === 0 && hasSearchCriteria ? (
                <div className="dropdown-empty">
                  <span>
                    No active identities found
                    {searchQuery ? ` matching "${searchQuery}"` : ''}
                    {selectedOrgUnits.size > 0 ? ` in ${selectedOrgUnits.size === 1 ? Array.from(selectedOrgUnits)[0] : `${selectedOrgUnits.size} departments`}` : ''}
                  </span>
                </div>
              ) : (
                <>
                  <div className="dropdown-count">
                    {filteredIdentities.length >= MAX_DISPLAY_RESULTS
                      ? `Showing first ${MAX_DISPLAY_RESULTS} results \u2014 refine your search to narrow down`
                      : `${filteredIdentities.length} result${filteredIdentities.length !== 1 ? 's' : ''}`
                    }
                    {selectedOrgUnits.size > 0 && (
                      <span className="count-filter">
                        {' '}in {selectedOrgUnits.size === 1 ? Array.from(selectedOrgUnits)[0] : `${selectedOrgUnits.size} depts`}
                      </span>
                    )}
                  </div>
                  {filteredIdentities.map((identity) => (
                    <div
                      key={identity.UId || identity.Id}
                      className={`dropdown-item ${selectedIdentity?.UId === identity.UId ? 'selected' : ''}`}
                      onClick={() => handleSelect(identity)}
                    >
                      <div className="dropdown-item-avatar">
                        {getInitials(identity)}
                      </div>
                      <div className="dropdown-item-info">
                        <div className="dropdown-item-name">
                          {formatDisplayName(identity)}
                        </div>
                        <div className="dropdown-item-details">
                          {identity.EMAIL && <span className="dropdown-item-email">{identity.EMAIL}</span>}
                          {identity.JOBTITLE && <span className="dropdown-item-title">{identity.JOBTITLE}</span>}
                        </div>
                        <div className="dropdown-item-meta">
                          {identity.EMPLOYEEID && <span>ID: {identity.EMPLOYEEID}</span>}
                          {getOrgUnitString(identity) && (
                            <span className="orgunit-tag">{getOrgUnitString(identity)}</span>
                          )}
                        </div>
                      </div>
                      {selectedIdentity?.UId === identity.UId && (
                        <div className="dropdown-item-check">{'\u2713'}</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Selected Identity Preview */}
        {selectedIdentity && (
          <div className="selected-preview">
            <div className="selected-preview-label">Selected:</div>
            <div className="selected-preview-content">
              <div className="selected-preview-avatar">
                {getInitials(selectedIdentity)}
              </div>
              <div className="selected-preview-info">
                <div className="selected-preview-name">{formatDisplayName(selectedIdentity)}</div>
                <div className="selected-preview-email">{selectedIdentity.EMAIL}</div>
                <div className="selected-preview-uid">UId: {selectedIdentity.UId}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="dialog-footer">
          <button className="btn-cancel" onClick={handleClose}>Cancel</button>
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={!selectedIdentity?.UId}
          >
            View in Identity360
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdentitySearchDialog;
