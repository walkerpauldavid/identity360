/**
 * Identities Table Component
 * Displays identities in a paginated table
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { omadaApi } from '../../services/omadaApi';
import IdentityDetail from './IdentityDetail';
import './IdentitiesList.css';

// Identity360 icon SVG component - matches the toolbar icon
const AccessLensIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

/**
 * Helper function to extract string value from field that might be an object or string
 * @param {*} field - The field value (could be string, object, or other)
 * @returns {string} - The extracted string value
 */
const extractFieldValue = (field) => {
  if (!field) return '-';

  // If it's already a string or number, return it
  if (typeof field === 'string' || typeof field === 'number') {
    return field;
  }

  // If it's an object, try to extract DisplayName, KeyValue, value (lowercase), or other common properties
  if (typeof field === 'object') {
    return field.DisplayName || field.KeyValue || field.value || field.Name || field.Value || '-';
  }

  return '-';
};

/**
 * Helper function to extract and format contexts/REF value
 * @param {*} ref - The REF field value (could be string, object, array, or other)
 * @returns {string} - Comma-separated list of contexts
 */
const extractContexts = (ref) => {
  if (!ref) return '-';

  // If it's a string, return it directly
  if (typeof ref === 'string') {
    return ref;
  }

  // If it's an array, extract values and join
  if (Array.isArray(ref)) {
    const contexts = ref.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object') {
        return item.DisplayName || item.KeyValue || item.Name || item.Value || '';
      }
      return '';
    }).filter(Boolean);
    return contexts.length > 0 ? contexts.join(', ') : '-';
  }

  // If it's an object, try to extract value
  if (typeof ref === 'object') {
    return ref.DisplayName || ref.KeyValue || ref.Name || ref.Value || '-';
  }

  return '-';
};

const IdentitiesTable = ({ identities, categoryColor }) => {
  const navigate = useNavigate();
  const { getBearerToken, user } = useAuth();
  const { preferences, setPreference } = usePreferences();

  // Handler to open Identity360 for an identity
  const handleOpenAccessLens = (e, identity) => {
    e.stopPropagation(); // Prevent row click from triggering
    const identityUId = identity.UId;
    if (identityUId) {
      // Navigate to Identity360 page with identity UId as query parameter
      navigate(`/identity360?identity=${identityUId}`);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(preferences.identitiesTablePageSize);
  const [sortColumn, setSortColumn] = useState(preferences.identitiesTableSortColumn);
  const [sortDirection, setSortDirection] = useState(preferences.identitiesTableSortDirection);
  const [contextsMap, setContextsMap] = useState({}); // Map of identityUId -> contexts
  const [loadingContexts, setLoadingContexts] = useState(false);

  // Column filters
  const [firstnameFilter, setFirstnameFilter] = useState('');
  const [lastnameFilter, setLastnameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [identityIdFilter, setIdentityIdFilter] = useState('');
  const [employeeIdFilter, setEmployeeIdFilter] = useState('');
  const [jobTitleFilter, setJobTitleFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [contextsFilter, setContextsFilter] = useState('');

  // Selected identity for detail view
  const [selectedIdentity, setSelectedIdentity] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: null
  });

  // Validate identities prop
  if (!identities) {
    return <div className="error-state">Error: No identities data provided</div>;
  }

  if (!Array.isArray(identities)) {
    return <div className="error-state">Error: Invalid identities data (not an array)</div>;
  }

  // Context menu handlers
  const handleContextMenu = (e, column, value) => {
    e.preventDefault();
    e.stopPropagation();

    // Only show context menu for filterable columns
    const filterableColumns = ['FIRSTNAME', 'LASTNAME', 'IDENTITYID', 'EMPLOYEEID', 'EMAIL', 'JOBTITLE', 'OUREF', 'IDENTITYSTATUS', 'CONTEXTS'];
    if (!filterableColumns.includes(column)) {
      return;
    }

    // Don't show menu for empty values
    if (!value || value === '-') {
      return;
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      column,
      value
    });
  };

  const hideContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      column: null,
      value: null
    });
  };

  const handleSetAsFilter = () => {
    const { column, value } = contextMenu;

    // Set the appropriate filter based on the column
    switch (column) {
      case 'FIRSTNAME':
        setFirstnameFilter(value);
        break;
      case 'LASTNAME':
        setLastnameFilter(value);
        break;
      case 'IDENTITYID':
        setIdentityIdFilter(value);
        break;
      case 'EMPLOYEEID':
        setEmployeeIdFilter(value);
        break;
      case 'EMAIL':
        setEmailFilter(value);
        break;
      case 'JOBTITLE':
        setJobTitleFilter(value);
        break;
      case 'OUREF':
        setOrganizationFilter(value);
        break;
      case 'IDENTITYSTATUS':
        setStatusFilter(value);
        break;
      case 'CONTEXTS':
        setContextsFilter(value);
        break;
      default:
        break;
    }

    // Reset to first page when filter is applied
    setCurrentPage(1);

    // Hide context menu
    hideContextMenu();
  };

  // Sort handler
  const handleSort = (column) => {
    let newDirection;
    if (sortColumn === column) {
      // Toggle direction if same column
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      setPreference('identitiesTableSortDirection', newDirection);
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
      setPreference('identitiesTableSortColumn', column);
      setPreference('identitiesTableSortDirection', 'asc');
    }
    // Reset to first page when sorting
    setCurrentPage(1);
  };

  // Filter identities by column filters
  const filteredIdentities = identities.filter((identity) => {
    // Firstname filter
    if (firstnameFilter) {
      const firstname = extractFieldValue(identity.FIRSTNAME).toLowerCase();
      if (!firstname.includes(firstnameFilter.toLowerCase())) {
        return false;
      }
    }

    // Lastname filter
    if (lastnameFilter) {
      const lastname = extractFieldValue(identity.LASTNAME).toLowerCase();
      if (!lastname.includes(lastnameFilter.toLowerCase())) {
        return false;
      }
    }

    // Email filter
    if (emailFilter) {
      const email = extractFieldValue(identity.EMAIL).toLowerCase();
      if (!email.includes(emailFilter.toLowerCase())) {
        return false;
      }
    }

    // Identity ID filter
    if (identityIdFilter) {
      const identityId = extractFieldValue(identity.IDENTITYID).toLowerCase();
      if (!identityId.includes(identityIdFilter.toLowerCase())) {
        return false;
      }
    }

    // Employee ID filter
    if (employeeIdFilter) {
      const employeeId = extractFieldValue(identity.EMPLOYEEID).toLowerCase();
      if (!employeeId.includes(employeeIdFilter.toLowerCase())) {
        return false;
      }
    }

    // Job Title filter
    if (jobTitleFilter) {
      const jobTitle = extractFieldValue(identity.JOBTITLE).toLowerCase();
      if (!jobTitle.includes(jobTitleFilter.toLowerCase())) {
        return false;
      }
    }

    // Organization filter
    if (organizationFilter) {
      const organization = extractFieldValue(identity.OUREF).toLowerCase();
      if (!organization.includes(organizationFilter.toLowerCase())) {
        return false;
      }
    }

    // Status filter
    if (statusFilter) {
      const status = extractFieldValue(identity.IDENTITYSTATUS).toLowerCase();
      if (!status.includes(statusFilter.toLowerCase())) {
        return false;
      }
    }

    // Contexts filter (filter based on loaded contexts)
    if (contextsFilter) {
      const identityUId = identity.UId;
      const contexts = contextsMap[identityUId];
      if (!contexts || contexts.length === 0) {
        return false; // No contexts loaded yet or empty
      }
      const contextsStr = contexts.join(', ').toLowerCase();
      if (!contextsStr.includes(contextsFilter.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Sort identities
  const sortedIdentities = [...filteredIdentities].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = extractFieldValue(a[sortColumn]);
    const bValue = extractFieldValue(b[sortColumn]);

    // Handle empty values
    if (aValue === '-' && bValue === '-') return 0;
    if (aValue === '-') return 1;
    if (bValue === '-') return -1;

    // Compare values
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
    } else {
      comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Calculate pagination (use sorted identities)
  const totalPages = Math.ceil(sortedIdentities.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedIdentities.length);
  const currentIdentities = sortedIdentities.slice(startIndex, endIndex);

  // Fetch contexts for visible identities
  useEffect(() => {
    const fetchContextsForVisibleIdentities = async () => {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      if (!bearerToken || currentIdentities.length === 0) {
        return;
      }

      // Get list of identities that need contexts fetched
      const identitiesToFetch = currentIdentities.filter(identity => {
        const identityUId = identity.UId;
        return identityUId && !contextsMap[identityUId];
      });

      console.log('=== Fetching Contexts ===');
      console.log('Current identities:', currentIdentities.length);
      console.log('Identities to fetch:', identitiesToFetch.length);
      console.log('Sample identity:', currentIdentities[0]);

      if (identitiesToFetch.length === 0) {
        console.log('No identities need contexts fetched');
        return; // All contexts already loaded
      }

      setLoadingContexts(true);

      try {
        // Fetch contexts for each visible identity that doesn't have them yet
        const contextsPromises = identitiesToFetch.map(async (identity) => {
          const identityUId = identity.UId;
          console.log(`Fetching contexts for identity UId: ${identityUId}`);

          try {
            const result = await omadaApi.identity.getIdentityContexts(
              identityUId,
              bearerToken,
              impersonateUser // May be null, which is OK
            );

            console.log(`Context result for ${identityUId}:`, result);
            if (result.status === 'success' && result.data) {
              // Extract context display names
              const contextNames = result.data.map(ctx => ctx.displayName || ctx.name || ctx.id).filter(Boolean);
              console.log(`Context names for ${identityUId}:`, contextNames);
              return { identityUId, contexts: contextNames };
            }
            return { identityUId, contexts: [] };
          } catch (error) {
            console.error(`Failed to fetch contexts for ${identityUId}:`, error);
            return { identityUId, contexts: [] };
          }
        });

        const contextsResults = await Promise.all(contextsPromises);

        // Update contexts map with new results
        setContextsMap(prevMap => {
          const newMap = { ...prevMap };
          contextsResults.forEach(({ identityUId, contexts }) => {
            newMap[identityUId] = contexts;
          });
          return newMap;
        });
      } catch (error) {
        console.error('Error fetching contexts:', error);
      } finally {
        setLoadingContexts(false);
      }
    };

    fetchContextsForVisibleIdentities();
  }, [currentPage, pageSize, getBearerToken, user?.email, currentIdentities, contextsMap]); // Re-fetch when page or identities change

  // Clear individual column filter
  const clearColumnFilter = (column) => {
    switch (column) {
      case 'FIRSTNAME':
        setFirstnameFilter('');
        break;
      case 'LASTNAME':
        setLastnameFilter('');
        break;
      case 'IDENTITYID':
        setIdentityIdFilter('');
        break;
      case 'EMPLOYEEID':
        setEmployeeIdFilter('');
        break;
      case 'EMAIL':
        setEmailFilter('');
        break;
      case 'JOBTITLE':
        setJobTitleFilter('');
        break;
      case 'OUREF':
        setOrganizationFilter('');
        break;
      case 'IDENTITYSTATUS':
        setStatusFilter('');
        break;
      case 'CONTEXTS':
        setContextsFilter('');
        break;
      default:
        break;
    }
    setCurrentPage(1); // Reset to first page when clearing filter
  };

  // Pagination handlers
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPreference('identitiesTablePageSize', newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  if (!identities || identities.length === 0) {
    return <div className="empty-state">No identities found in this category.</div>;
  }

  if (filteredIdentities.length === 0) {
    return (
      <div className="empty-state">
        <p>No identities match the current filters.</p>
      </div>
    );
  }

  if (!currentIdentities || currentIdentities.length === 0) {
    return (
      <div className="empty-state">
        <p>Pagination error: No items on current page</p>
        <p>Total: {filteredIdentities.length}, Page: {currentPage}, Page Size: {pageSize}</p>
      </div>
    );
  }

  // Hide context menu when clicking anywhere
  useEffect(() => {
    if (contextMenu.visible) {
      document.addEventListener('click', hideContextMenu);
      return () => {
        document.removeEventListener('click', hideContextMenu);
      };
    }
  }, [contextMenu.visible]);

  return (
    <div className="identities-table-container">
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleSetAsFilter} className="context-menu-item">
            Set as filter
          </button>
        </div>
      )}

      {/* Table */}
      <table className="identities-table" style={{ borderLeftColor: categoryColor }}>
        <thead>
          <tr>
            <th className="access-lens-column" style={{ width: '40px', textAlign: 'center' }}>
              <div className="th-content" title="Open in Identity360">
                <AccessLensIcon />
              </div>
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('FIRSTNAME')}>
                <span className="column-title-with-clear">
                  <span>First Name</span>
                  {firstnameFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('FIRSTNAME');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'FIRSTNAME' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'FIRSTNAME' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={firstnameFilter}
                onChange={(e) => {
                  setFirstnameFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('LASTNAME')}>
                <span className="column-title-with-clear">
                  <span>Last Name</span>
                  {lastnameFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('LASTNAME');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'LASTNAME' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'LASTNAME' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={lastnameFilter}
                onChange={(e) => {
                  setLastnameFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('IDENTITYID')}>
                <span className="column-title-with-clear">
                  <span>Identity ID</span>
                  {identityIdFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('IDENTITYID');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'IDENTITYID' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'IDENTITYID' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={identityIdFilter}
                onChange={(e) => {
                  setIdentityIdFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('EMPLOYEEID')}>
                <span className="column-title-with-clear">
                  <span>Employee ID</span>
                  {employeeIdFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('EMPLOYEEID');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'EMPLOYEEID' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'EMPLOYEEID' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={employeeIdFilter}
                onChange={(e) => {
                  setEmployeeIdFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('EMAIL')}>
                <span className="column-title-with-clear">
                  <span>Email</span>
                  {emailFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('EMAIL');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'EMAIL' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'EMAIL' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={emailFilter}
                onChange={(e) => {
                  setEmailFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('JOBTITLE')}>
                <span className="column-title-with-clear">
                  <span>Job Title</span>
                  {jobTitleFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('JOBTITLE');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'JOBTITLE' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'JOBTITLE' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={jobTitleFilter}
                onChange={(e) => {
                  setJobTitleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('OUREF')}>
                <span className="column-title-with-clear">
                  <span>Organization</span>
                  {organizationFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('OUREF');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'OUREF' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'OUREF' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={organizationFilter}
                onChange={(e) => {
                  setOrganizationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="filterable-column">
              <div className="th-content sortable" onClick={() => handleSort('IDENTITYSTATUS')}>
                <span className="column-title-with-clear">
                  <span>Status</span>
                  {statusFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('IDENTITYSTATUS');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'IDENTITYSTATUS' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'IDENTITYSTATUS' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="sortable" onClick={() => handleSort('RISKLEVEL')}>
              <div className="th-content">
                <span>Risk Level</span>
                <span className="sort-indicators">
                  <span className={`sort-arrow ${sortColumn === 'RISKLEVEL' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                  <span className={`sort-arrow ${sortColumn === 'RISKLEVEL' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                </span>
              </div>
            </th>
            <th className="filterable-column">
              <div className="th-content">
                <span className="column-title-with-clear">
                  <span>Contexts</span>
                  {contextsFilter && (
                    <button
                      className="clear-column-filter"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearColumnFilter('CONTEXTS');
                      }}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
              <input
                type="text"
                className="column-filter-input"
                placeholder="Filter..."
                value={contextsFilter}
                onChange={(e) => {
                  setContextsFilter(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {currentIdentities.map((identity) => {
            const identityUId = identity.UId;
            const contexts = contextsMap[identityUId];
            let contextsDisplay;

            if (contexts === undefined && loadingContexts) {
              contextsDisplay = 'Loading...';
            } else if (contexts && contexts.length > 0) {
              contextsDisplay = contexts.join(', ');
            } else if (contexts !== undefined) {
              contextsDisplay = '-';
            } else {
              contextsDisplay = 'Loading...';
            }

            return (
              <tr
                key={identity.Id || identity.UId}
                onClick={() => setSelectedIdentity(identity)}
                className="clickable-row"
              >
                <td
                  className="access-lens-cell"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={(e) => handleOpenAccessLens(e, identity)}
                  title={`Open Identity360 for ${extractFieldValue(identity.DISPLAYNAME) || extractFieldValue(identity.FIRSTNAME) + ' ' + extractFieldValue(identity.LASTNAME)}`}
                >
                  <button className="access-lens-btn" aria-label="Open in Identity360">
                    <AccessLensIcon />
                  </button>
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'FIRSTNAME', extractFieldValue(identity.FIRSTNAME))}
                >
                  {extractFieldValue(identity.FIRSTNAME)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'LASTNAME', extractFieldValue(identity.LASTNAME))}
                >
                  {extractFieldValue(identity.LASTNAME)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'IDENTITYID', extractFieldValue(identity.IDENTITYID))}
                >
                  {extractFieldValue(identity.IDENTITYID)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'EMPLOYEEID', extractFieldValue(identity.EMPLOYEEID))}
                >
                  {extractFieldValue(identity.EMPLOYEEID)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'EMAIL', extractFieldValue(identity.EMAIL))}
                >
                  {extractFieldValue(identity.EMAIL)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'JOBTITLE', extractFieldValue(identity.JOBTITLE))}
                >
                  {extractFieldValue(identity.JOBTITLE)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'OUREF', extractFieldValue(identity.OUREF))}
                >
                  {extractFieldValue(identity.OUREF)}
                </td>
                <td
                  onContextMenu={(e) => handleContextMenu(e, 'IDENTITYSTATUS', extractFieldValue(identity.IDENTITYSTATUS))}
                >
                  {extractFieldValue(identity.IDENTITYSTATUS)}
                </td>
                <td>{extractFieldValue(identity.RISKLEVEL)}</td>
                <td
                  className={loadingContexts && contexts === undefined ? 'loading-cell' : ''}
                  onContextMenu={(e) => handleContextMenu(e, 'CONTEXTS', contextsDisplay)}
                >
                  {contextsDisplay}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className="pagination-controls">
        <div className="pagination-info">
          Showing {startIndex + 1}-{endIndex} of {filteredIdentities.length} identities
          {(firstnameFilter || lastnameFilter || emailFilter || identityIdFilter || employeeIdFilter || jobTitleFilter || organizationFilter || statusFilter || contextsFilter) && (
            <span className="filtered-text"> (filtered from {identities.length})</span>
          )}
        </div>

        <div className="pagination-buttons">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="btn btn-small"
            title="First page"
          >
            «
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="btn btn-small"
            title="Previous page"
          >
            ‹
          </button>

          <span className="page-indicator">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="btn btn-small"
            title="Next page"
          >
            ›
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            className="btn btn-small"
            title="Last page"
          >
            »
          </button>
        </div>

        <div className="page-size-selector">
          <label htmlFor="page-size">Per page:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Identity Detail Panel */}
      {selectedIdentity && (
        <IdentityDetail
          identity={selectedIdentity}
          onClose={() => setSelectedIdentity(null)}
        />
      )}
    </div>
  );
};

export default IdentitiesTable;
