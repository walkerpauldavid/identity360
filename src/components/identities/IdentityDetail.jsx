/**
 * Identity Detail Panel
 * Displays all attributes of a selected identity in a slide-in panel
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { omadaApi } from '../../services/omadaApi';
import { AccessLens } from '../access-lens';
import './IdentityDetail.css';

const IdentityDetail = ({ identity, onClose, onMinimize }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState(null);

  // Access Rights view mode: 'tiles', 'table', 'graph'
  const [accessRightsView, setAccessRightsView] = useState('tiles');

  // Fullscreen mode for AccessLens
  const [isAccessLensFullscreen, setIsAccessLensFullscreen] = useState(false);

  // Table sorting and filtering (default sort by system, then status)
  const [sortColumn, setSortColumn] = useState('system');
  const [sortDirection, setSortDirection] = useState('asc');
  const [secondarySortColumn] = useState('status');
  const [resourceFilter, setResourceFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  // Context menu for table
  const [tableContextMenu, setTableContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: null
  });

  const { getBearerToken, user } = useAuth();

  if (!identity) return null;

  // Fetch assignments when Access Rights tab is opened
  useEffect(() => {
    const loadAssignments = async () => {
      if (activeTab === 'access-rights' && identity.UId && assignments.length === 0) {
        setLoadingAssignments(true);
        setAssignmentsError(null);

        try {
          const bearerToken = getBearerToken();
          const impersonateUser = user?.email;

          console.log('=== Fetching Calculated Assignments ===');
          console.log('Identity UId:', identity.UId);
          console.log('Bearer Token exists:', !!bearerToken);
          console.log('Impersonate User:', impersonateUser);

          const result = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            identity.UId,
            bearerToken,
            impersonateUser,
            {}, // filters
            { page: 1, rows: 100 } // pagination
          );

          console.log('=== Assignment Result ===');
          console.log('Full result:', result);
          console.log('Status:', result.status);
          console.log('Data:', result.data);
          console.log('Data length:', result.data?.length);

          if (result.status === 'success') {
            setAssignments(result.data || []);
            console.log('Assignments set:', result.data?.length || 0, 'items');
          } else {
            console.error('Assignment fetch failed with status:', result.status);
            setAssignmentsError('Failed to load assignments');
          }
        } catch (error) {
          console.error('Error fetching assignments:', error);
          console.error('Error details:', error.message, error.stack);
          setAssignmentsError(error.message || 'Failed to load assignments');
        } finally {
          setLoadingAssignments(false);
        }
      }
    };

    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, identity.UId]);

  // Helper to format field values
  const formatValue = (value) => {
    if (!value) return '-';

    if (typeof value === 'object' && value !== null) {
      // Try to extract display value from object
      return value.DisplayName || value.KeyValue || value.value || value.Name || value.Value || JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  };

  // Get all keys from the identity object
  const allKeys = Object.keys(identity).sort();

  return (
    <>
      {/* Backdrop */}
      <div className="identity-detail-backdrop" onClick={onClose}></div>

      {/* Detail Panel */}
      <div className="identity-detail-panel">
        {/* Header */}
        <div className="identity-detail-header">
          <div className="identity-detail-title">
            <h2>Identity Details</h2>
            <p className="identity-name">
              {formatValue(identity.FIRSTNAME)} {formatValue(identity.LASTNAME)}
            </p>
          </div>
          <button onClick={onClose} className="btn-close-detail">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="identity-detail-tabs">
          <button
            className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tab-button ${activeTab === 'access-rights' ? 'active' : ''}`}
            onClick={() => setActiveTab('access-rights')}
          >
            Access Rights
          </button>
          <button
            className={`tab-button ${activeTab === 'audit-log' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit-log')}
          >
            Audit Log
          </button>
        </div>

        {/* Content */}
        <div className="identity-detail-content">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              {/* Key Information Section */}
              <section className="detail-section">
                <h3 className="section-title">Key Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">First Name:</span>
                    <span className="detail-value">{formatValue(identity.FIRSTNAME)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Last Name:</span>
                    <span className="detail-value">{formatValue(identity.LASTNAME)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Display Name:</span>
                    <span className="detail-value">{formatValue(identity.DISPLAYNAME)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{formatValue(identity.EMAIL)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Identity ID:</span>
                    <span className="detail-value">{formatValue(identity.IDENTITYID)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Employee ID:</span>
                    <span className="detail-value">{formatValue(identity.EMPLOYEEID)}</span>
                  </div>
                </div>
              </section>

              {/* Employment Information */}
              <section className="detail-section">
                <h3 className="section-title">Employment Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Job Title:</span>
                    <span className="detail-value">{formatValue(identity.JOBTITLE)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Organization:</span>
                    <span className="detail-value">{formatValue(identity.OUREF)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Category:</span>
                    <span className="detail-value">{formatValue(identity.IDENTITYCATEGORY)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">{formatValue(identity.IDENTITYSTATUS)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Risk Level:</span>
                    <span className="detail-value">{formatValue(identity.RISKLEVEL)}</span>
                  </div>
                </div>
              </section>

              {/* System Information */}
              <section className="detail-section">
                <h3 className="section-title">System Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">UId:</span>
                    <span className="detail-value detail-value-mono">{formatValue(identity.UId)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Id:</span>
                    <span className="detail-value">{formatValue(identity.Id)}</span>
                  </div>
                </div>
              </section>

              {/* All Attributes Section */}
              <section className="detail-section">
                <h3 className="section-title">All Attributes</h3>
                <div className="detail-list">
                  {allKeys.map((key) => (
                    <div key={key} className="detail-item-full">
                      <span className="detail-label">{key}:</span>
                      <span className="detail-value">{formatValue(identity[key])}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Access Rights Tab */}
          {activeTab === 'access-rights' && (
            <>
              <section className="detail-section">
                <div className="access-rights-header">
                  <h3 className="section-title">Access Rights & Assignments</h3>
                  <div className="view-selector">
                    <button
                      className={`view-btn ${accessRightsView === 'tiles' ? 'active' : ''}`}
                      onClick={() => setAccessRightsView('tiles')}
                      title="Tiles View"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="1" y="1" width="6" height="6" rx="1"/>
                        <rect x="9" y="1" width="6" height="6" rx="1"/>
                        <rect x="1" y="9" width="6" height="6" rx="1"/>
                        <rect x="9" y="9" width="6" height="6" rx="1"/>
                      </svg>
                    </button>
                    <button
                      className={`view-btn ${accessRightsView === 'table' ? 'active' : ''}`}
                      onClick={() => setAccessRightsView('table')}
                      title="Table View"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="1" y="1" width="14" height="3" rx="1"/>
                        <rect x="1" y="6" width="14" height="3" rx="1"/>
                        <rect x="1" y="11" width="14" height="3" rx="1"/>
                      </svg>
                    </button>
                    <button
                      className={`view-btn ${accessRightsView === 'graph' ? 'active' : ''}`}
                      onClick={() => setAccessRightsView('graph')}
                      title="Graph View"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="4" r="2"/>
                        <circle cx="4" cy="12" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <line x1="8" y1="6" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5"/>
                        <line x1="8" y1="6" x2="12" y2="10" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {loadingAssignments && (
                  <div className="loading-assignments">
                    <div className="spinner-small"></div>
                    <p>Loading assignments...</p>
                  </div>
                )}

                {assignmentsError && (
                  <div className="error-message">
                    <p>Error: {assignmentsError}</p>
                  </div>
                )}

                {!loadingAssignments && !assignmentsError && assignments.length === 0 && (
                  <div className="empty-tab-message">
                    <p>No assignments found for this identity.</p>
                  </div>
                )}

                {/* TILES VIEW */}
                {!loadingAssignments && !assignmentsError && assignments.length > 0 && accessRightsView === 'tiles' && (
                  <div className="assignments-tiles">
                    {assignments.map((assignment, index) => (
                      <div key={assignment.id || index} className="assignment-tile">
                        <div className="tile-header">
                          <span className="tile-resource">{assignment.resource?.name || 'Unknown'}</span>
                          {assignment.complianceStatus && (
                            <span className={`tile-status ${assignment.complianceStatus.toLowerCase().replace(' ', '-')}`}>
                              {assignment.complianceStatus}
                            </span>
                          )}
                        </div>
                        <div className="tile-system">{assignment.resource?.system?.name || '-'}</div>
                        <div className="tile-type">{assignment.resource?.resourceType?.name || '-'}</div>
                        {assignment.account?.accountName && (
                          <div className="tile-account">{assignment.account.accountName}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* TABLE VIEW */}
                {!loadingAssignments && !assignmentsError && assignments.length > 0 && accessRightsView === 'table' && (
                  <div className="assignments-table-container">
                    <table className="assignments-table">
                      <thead>
                        <tr>
                          <th>
                            <div className="th-content" onClick={() => {
                              if (sortColumn === 'resource') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortColumn('resource');
                                setSortDirection('asc');
                              }
                            }}>
                              Resource
                              <span className="sort-indicator">{sortColumn === 'resource' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                            </div>
                            <input
                              type="text"
                              className="table-filter"
                              placeholder="Filter..."
                              value={resourceFilter}
                              onChange={(e) => setResourceFilter(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </th>
                          <th>
                            <div className="th-content" onClick={() => {
                              if (sortColumn === 'system') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortColumn('system');
                                setSortDirection('asc');
                              }
                            }}>
                              System
                              <span className="sort-indicator">{sortColumn === 'system' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                            </div>
                            <input
                              type="text"
                              className="table-filter"
                              placeholder="Filter..."
                              value={systemFilter}
                              onChange={(e) => setSystemFilter(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </th>
                          <th>Type</th>
                          <th>
                            <div className="th-content" onClick={() => {
                              if (sortColumn === 'status') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortColumn('status');
                                setSortDirection('asc');
                              }
                            }}>
                              Status
                              <span className="sort-indicator">{sortColumn === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                            </div>
                            <input
                              type="text"
                              className="table-filter"
                              placeholder="Filter..."
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </th>
                          <th>Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments
                          .filter(a => {
                            const resourceName = (a.resource?.name || '').toLowerCase();
                            const systemName = (a.resource?.system?.name || '').toLowerCase();
                            const status = (a.complianceStatus || '').toLowerCase();
                            return resourceName.includes(resourceFilter.toLowerCase()) &&
                                   systemName.includes(systemFilter.toLowerCase()) &&
                                   status.includes(statusFilter.toLowerCase());
                          })
                          .sort((a, b) => {
                            if (!sortColumn) return 0;
                            let aVal, bVal;
                            switch (sortColumn) {
                              case 'resource': aVal = a.resource?.name || ''; bVal = b.resource?.name || ''; break;
                              case 'system': aVal = a.resource?.system?.name || ''; bVal = b.resource?.system?.name || ''; break;
                              case 'status': aVal = a.complianceStatus || ''; bVal = b.complianceStatus || ''; break;
                              default: return 0;
                            }
                            const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
                            return sortDirection === 'asc' ? cmp : -cmp;
                          })
                          .map((assignment, index) => (
                            <tr key={assignment.id || index}>
                              <td>{assignment.resource?.name || '-'}</td>
                              <td>{assignment.resource?.system?.name || '-'}</td>
                              <td>{assignment.resource?.resourceType?.name || '-'}</td>
                              <td>
                                <span className={`table-status ${(assignment.complianceStatus || 'unknown').toLowerCase().replace(' ', '-')}`}>
                                  {assignment.complianceStatus || '-'}
                                </span>
                              </td>
                              <td>{assignment.account?.accountName || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* GRAPH VIEW - AccessLens */}
                {!loadingAssignments && !assignmentsError && accessRightsView === 'graph' && (
                  <div className="access-lens-container">
                    <div className="access-lens-header">
                      <span className="access-lens-label">Access Lens - Interactive Access Graph</span>
                      <button
                        className="fullscreen-btn"
                        onClick={() => setIsAccessLensFullscreen(true)}
                        title="Open in fullscreen"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                        Fullscreen
                      </button>
                    </div>
                    <AccessLens
                      identity={identity}
                      isFullscreen={false}
                    />
                  </div>
                )}

                {/* AccessLens Fullscreen Mode */}
                {isAccessLensFullscreen && (
                  <AccessLens
                    identity={identity}
                    isFullscreen={true}
                    onClose={() => setIsAccessLensFullscreen(false)}
                  />
                )}
              </section>
            </>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit-log' && (
            <>
              <section className="detail-section">
                <h3 className="section-title">Audit Log</h3>
                <div className="empty-tab-message">
                  <p>Audit log entries will be displayed here.</p>
                  <p className="empty-tab-subtitle">This feature is coming soon.</p>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default IdentityDetail;
