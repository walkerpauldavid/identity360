/**
 * IdentitySearchDialog Component
 * Modal dialog with an editable dropdown for selecting an identity to view in Access Lens
 *
 * IMPORTANT: Uses UId (32-character GUID) for identity selection, NOT Id or IdentityID
 * The UId is required for getIdentityContexts and getCalculatedAssignmentsDetailed APIs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { omadaApi } from '../../services/omadaApi';
import './IdentitySearchDialog.css';

const PAGE_SIZE = 50;

const IdentitySearchDialog = ({ isOpen, onClose, onSelectIdentity }) => {
  const { getBearerToken, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [identities, setIdentities] = useState([]);
  const [filteredIdentities, setFilteredIdentities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const canCloseRef = useRef(false); // Prevent immediate close on mount

  // Load initial identities when dialog opens
  useEffect(() => {
    console.log('IdentitySearchDialog: useEffect triggered, isOpen =', isOpen);
    if (isOpen) {
      console.log('IdentitySearchDialog: Dialog OPENING');
      // Prevent closing for the first 500ms to avoid accidental closes
      canCloseRef.current = false;
      const timer = setTimeout(() => {
        canCloseRef.current = true;
        console.log('IdentitySearchDialog: canCloseRef now TRUE (500ms elapsed)');
      }, 500);

      loadIdentities(1, true);
      setIsDropdownOpen(true);
      // Focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 100);

      return () => clearTimeout(timer);
    } else {
      console.log('IdentitySearchDialog: Dialog CLOSING (isOpen=false)');
      // Reset state when closed
      setSearchQuery('');
      setIdentities([]);
      setFilteredIdentities([]);
      setSelectedIdentity(null);
      setCurrentPage(1);
      setTotalCount(0);
      setHasMore(false);
      setError(null);
      canCloseRef.current = false;
    }
  }, [isOpen]);

  // Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && canCloseRef.current) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Filter identities based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredIdentities(identities);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = identities.filter(identity => {
        const displayName = (identity.DISPLAYNAME || '').toLowerCase();
        const firstName = (identity.FIRSTNAME || '').toLowerCase();
        const lastName = (identity.LASTNAME || '').toLowerCase();
        const email = (identity.EMAIL || '').toLowerCase();
        const employeeId = (identity.EMPLOYEEID || '').toLowerCase();

        return displayName.includes(query) ||
               firstName.includes(query) ||
               lastName.includes(query) ||
               email.includes(query) ||
               employeeId.includes(query);
      });
      setFilteredIdentities(filtered);
    }
  }, [searchQuery, identities]);

  /**
   * Load identities via OData
   * @param {number} page - Page number (1-based)
   * @param {boolean} resetResults - Whether to replace or append results
   */
  const loadIdentities = async (page = 1, resetResults = true) => {
    if (resetResults) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      const skip = (page - 1) * PAGE_SIZE;

      // Load identities sorted alphabetically
      const result = await omadaApi.identity.searchIdentities(
        null, // No filter - load all
        bearerToken,
        impersonateUser,
        {
          top: PAGE_SIZE,
          skip: skip,
          // Select fields including UId (32-char GUID) - this is critical!
          select: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL',
          // Order alphabetically by last name, then first name
          orderBy: 'LASTNAME,FIRSTNAME'
        }
      );

      if (result.status === 'success') {
        const newResults = result.data || [];
        const total = result.total || 0;

        if (resetResults) {
          setIdentities(newResults);
          setFilteredIdentities(newResults);
        } else {
          // Append new results, avoiding duplicates by UId
          setIdentities(prev => {
            const existingUIds = new Set(prev.map(i => i.UId));
            const uniqueNew = newResults.filter(i => !existingUIds.has(i.UId));
            return [...prev, ...uniqueNew];
          });
        }

        setTotalCount(total);
        setCurrentPage(page);
        setHasMore(skip + newResults.length < total);
      } else {
        setError('Failed to load identities');
        if (resetResults) {
          setIdentities([]);
          setFilteredIdentities([]);
        }
      }
    } catch (err) {
      console.error('Error loading identities:', err);
      setError(err.message || 'Failed to load identities');
      if (resetResults) {
        setIdentities([]);
        setFilteredIdentities([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Handle scroll to load more
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Load more when scrolled near bottom (within 100px)
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isLoadingMore) {
      loadIdentities(currentPage + 1, false);
    }
  };

  // Handle identity selection
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

  // Handle input change
  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setSelectedIdentity(null);
    setIsDropdownOpen(true);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedIdentity && selectedIdentity.UId) {
      console.log('Selected identity UId (32-char GUID):', selectedIdentity.UId);
      onSelectIdentity(selectedIdentity);
      handleClose();
    }
  };

  // Handle close
  const handleClose = () => {
    // Debug: trace the call stack to see what's triggering the close
    console.log('IdentitySearchDialog: handleClose called');
    console.log('IdentitySearchDialog: canCloseRef.current =', canCloseRef.current);
    console.trace('IdentitySearchDialog: close trace');

    setSearchQuery('');
    setIdentities([]);
    setFilteredIdentities([]);
    setSelectedIdentity(null);
    setError(null);
    setCurrentPage(1);
    setTotalCount(0);
    setHasMore(false);
    setIsDropdownOpen(false);
    onClose();
  };

  // Format display name
  const formatDisplayName = (identity) => {
    if (identity.DISPLAYNAME) return identity.DISPLAYNAME;
    const firstName = identity.FIRSTNAME || '';
    const lastName = identity.LASTNAME || '';
    if (lastName && firstName) return `${lastName}, ${firstName}`;
    return lastName || firstName || 'Unknown';
  };

  // Get initials for avatar
  const getInitials = (identity) => {
    if (identity.FIRSTNAME && identity.LASTNAME) {
      return `${identity.FIRSTNAME[0]}${identity.LASTNAME[0]}`.toUpperCase();
    }
    if (identity.DISPLAYNAME) {
      const parts = identity.DISPLAYNAME.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return identity.DISPLAYNAME[0].toUpperCase();
    }
    return '?';
  };

  // Safely get status string from IDENTITYSTATUS (handles both string and object formats)
  const getStatusString = (status) => {
    if (!status) return 'Active';
    if (typeof status === 'string') return status;
    if (typeof status === 'object') {
      // Handle object format like { DisplayName: "Active", Id: 1 }
      return status.DisplayName || status.Name || status.Value || 'Active';
    }
    return String(status);
  };

  // Handle overlay click - only close if clicking directly on the overlay, not children
  const handleOverlayClick = (e) => {
    // Only close if:
    // 1. The click target is the overlay itself (not a child)
    // 2. We've passed the initial delay (canCloseRef is true)
    if (e.target === e.currentTarget && canCloseRef.current) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="identity-search-dialog-overlay" onClick={handleOverlayClick}>
      <div className="identity-search-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2>Select Identity</h2>
          <button className="dialog-close-btn" onClick={handleClose}>
            &times;
          </button>
        </div>

        {/* Dropdown Container */}
        <div className="dropdown-container">
          <label className="dropdown-label">Choose an identity to view in Access Lens:</label>

          {/* Editable Dropdown Input */}
          <div className="dropdown-input-wrapper">
            <svg className="dropdown-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="dropdown-input"
              placeholder="Type to filter or scroll to browse..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
            />
            <button
              className="dropdown-toggle-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {isDropdownOpen ? '▲' : '▼'}
            </button>
          </div>

          {/* Dropdown List */}
          {isDropdownOpen && (
            <div
              className="dropdown-list"
              ref={dropdownRef}
              onScroll={handleScroll}
            >
              {isLoading ? (
                <div className="dropdown-loading">
                  <div className="dropdown-spinner"></div>
                  <span>Loading identities...</span>
                </div>
              ) : error ? (
                <div className="dropdown-error">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              ) : filteredIdentities.length === 0 ? (
                <div className="dropdown-empty">
                  {searchQuery ? (
                    <span>No identities match "{searchQuery}"</span>
                  ) : (
                    <span>No identities available</span>
                  )}
                </div>
              ) : (
                <>
                  <div className="dropdown-count">
                    {searchQuery ? (
                      `${filteredIdentities.length} matches`
                    ) : (
                      `${identities.length} of ${totalCount} identities loaded (A-Z)`
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
                          <span className={`status-badge ${getStatusString(identity.IDENTITYSTATUS).toLowerCase()}`}>
                            {getStatusString(identity.IDENTITYSTATUS)}
                          </span>
                        </div>
                        <div className="dropdown-item-uid">
                          UId: {identity.UId || 'N/A'}
                        </div>
                      </div>
                      {selectedIdentity?.UId === identity.UId && (
                        <div className="dropdown-item-check">✓</div>
                      )}
                    </div>
                  ))}
                  {/* Loading more indicator */}
                  {isLoadingMore && (
                    <div className="dropdown-loading-more">
                      <div className="dropdown-spinner-small"></div>
                      <span>Loading more...</span>
                    </div>
                  )}
                  {/* Load more prompt */}
                  {hasMore && !isLoadingMore && !searchQuery && (
                    <div className="dropdown-load-more">
                      Scroll down to load more ({totalCount - identities.length} remaining)
                    </div>
                  )}
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
          <button className="btn-cancel" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={!selectedIdentity || !selectedIdentity.UId}
          >
            View in Access Lens
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdentitySearchDialog;
