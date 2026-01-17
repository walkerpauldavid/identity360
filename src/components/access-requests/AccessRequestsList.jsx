/**
 * Access Requests List Component
 * Displays access requests in a paginated table with filtering
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGetAccessRequests } from '../../hooks/useOmadaApi';
import './AccessRequestsList.css';

/**
 * Helper function to format date strings
 */
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
};

/**
 * Get status badge class based on approval status
 */
const getStatusBadgeClass = (status) => {
  if (!status) return 'status-unknown';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('approved') || lowerStatus.includes('complete')) return 'status-approved';
  if (lowerStatus.includes('pending') || lowerStatus.includes('waiting')) return 'status-pending';
  if (lowerStatus.includes('rejected') || lowerStatus.includes('denied')) return 'status-rejected';
  return 'status-unknown';
};

const AccessRequestsList = () => {
  const { getBearerToken, user } = useAuth();
  const bearerToken = getBearerToken();
  const impersonateUser = user?.email;

  // Fetch access requests
  const { data: requestsData, isLoading, error } = useGetAccessRequests(bearerToken, impersonateUser);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Column filters
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('');
  const [provisioningStatusFilter, setProvisioningStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    column: null,
    value: null
  });

  const requests = requestsData?.data || [];

  // Context menu handlers
  const handleContextMenu = (e, column, value) => {
    e.preventDefault();
    e.stopPropagation();

    if (!value || value === '-') return;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      column,
      value
    });
  };

  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, column: null, value: null });
  };

  const handleSetAsFilter = () => {
    const { column, value } = contextMenu;

    switch (column) {
      case 'beneficiary':
        setBeneficiaryFilter(value);
        break;
      case 'resource':
        setResourceFilter(value);
        break;
      case 'approvalStatus':
        setApprovalStatusFilter(value);
        break;
      case 'provisioningStatus':
        setProvisioningStatusFilter(value);
        break;
      case 'reason':
        setReasonFilter(value);
        break;
      default:
        break;
    }

    setCurrentPage(1);
    hideContextMenu();
  };

  // Sort handler
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Filter requests
  const filteredRequests = requests.filter((request) => {
    // Beneficiary filter
    if (beneficiaryFilter) {
      const beneficiaryName = `${request.beneficiary?.firstName || ''} ${request.beneficiary?.lastName || ''}`.toLowerCase();
      if (!beneficiaryName.includes(beneficiaryFilter.toLowerCase())) {
        return false;
      }
    }

    // Resource filter
    if (resourceFilter) {
      const resourceName = (request.resource?.name || '').toLowerCase();
      if (!resourceName.includes(resourceFilter.toLowerCase())) {
        return false;
      }
    }

    // Approval Status filter
    if (approvalStatusFilter) {
      const status = (request.status?.approvalStatus || '').toLowerCase();
      if (!status.includes(approvalStatusFilter.toLowerCase())) {
        return false;
      }
    }

    // Provisioning Status filter
    if (provisioningStatusFilter) {
      const status = (request.status?.provisioningStatus || '').toLowerCase();
      if (!status.includes(provisioningStatusFilter.toLowerCase())) {
        return false;
      }
    }

    // Reason filter
    if (reasonFilter) {
      const reason = (request.reason || '').toLowerCase();
      if (!reason.includes(reasonFilter.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Sort requests
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue, bValue;

    switch (sortColumn) {
      case 'beneficiary':
        aValue = `${a.beneficiary?.firstName || ''} ${a.beneficiary?.lastName || ''}`;
        bValue = `${b.beneficiary?.firstName || ''} ${b.beneficiary?.lastName || ''}`;
        break;
      case 'resource':
        aValue = a.resource?.name || '';
        bValue = b.resource?.name || '';
        break;
      case 'approvalStatus':
        aValue = a.status?.approvalStatus || '';
        bValue = b.status?.approvalStatus || '';
        break;
      case 'provisioningStatus':
        aValue = a.status?.provisioningStatus || '';
        bValue = b.status?.provisioningStatus || '';
        break;
      case 'validFrom':
        aValue = a.validFrom || '';
        bValue = b.validFrom || '';
        break;
      case 'validTo':
        aValue = a.validTo || '';
        bValue = b.validTo || '';
        break;
      case 'reason':
        aValue = a.reason || '';
        bValue = b.reason || '';
        break;
      default:
        return 0;
    }

    const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedRequests.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sortedRequests.length);
  const currentRequests = sortedRequests.slice(startIndex, endIndex);

  // Clear individual column filter
  const clearColumnFilter = (column) => {
    switch (column) {
      case 'beneficiary':
        setBeneficiaryFilter('');
        break;
      case 'resource':
        setResourceFilter('');
        break;
      case 'approvalStatus':
        setApprovalStatusFilter('');
        break;
      case 'provisioningStatus':
        setProvisioningStatusFilter('');
        break;
      case 'reason':
        setReasonFilter('');
        break;
      default:
        break;
    }
    setCurrentPage(1);
  };

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Hide context menu when clicking anywhere
  useEffect(() => {
    if (contextMenu.visible) {
      document.addEventListener('click', hideContextMenu);
      return () => document.removeEventListener('click', hideContextMenu);
    }
  }, [contextMenu.visible]);

  if (isLoading) {
    return (
      <div className="access-requests-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading access requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="access-requests-page">
        <div className="error-state">
          <p>Error loading access requests: {error.message}</p>
        </div>
      </div>
    );
  }

  const hasFilters = beneficiaryFilter || resourceFilter || approvalStatusFilter || provisioningStatusFilter || reasonFilter;

  return (
    <div className="access-requests-page">
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleSetAsFilter} className="context-menu-item">
            Set as filter
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="requests-summary">
        <span className="total-count">{requestsData?.total || 0} Total Requests</span>
        {hasFilters && (
          <span className="filtered-count">({filteredRequests.length} shown)</span>
        )}
      </div>

      {/* Table */}
      <div className="requests-table-container">
        <table className="requests-table">
          <thead>
            <tr>
              <th className="filterable-column">
                <div className="th-content sortable" onClick={() => handleSort('beneficiary')}>
                  <span className="column-title-with-clear">
                    <span>Beneficiary</span>
                    {beneficiaryFilter && (
                      <button className="clear-column-filter" onClick={(e) => { e.stopPropagation(); clearColumnFilter('beneficiary'); }} title="Clear filter">✕</button>
                    )}
                  </span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'beneficiary' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'beneficiary' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
                <input
                  type="text"
                  className="column-filter-input"
                  placeholder="Filter..."
                  value={beneficiaryFilter}
                  onChange={(e) => { setBeneficiaryFilter(e.target.value); setCurrentPage(1); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th className="filterable-column">
                <div className="th-content sortable" onClick={() => handleSort('resource')}>
                  <span className="column-title-with-clear">
                    <span>Resource</span>
                    {resourceFilter && (
                      <button className="clear-column-filter" onClick={(e) => { e.stopPropagation(); clearColumnFilter('resource'); }} title="Clear filter">✕</button>
                    )}
                  </span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'resource' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'resource' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
                <input
                  type="text"
                  className="column-filter-input"
                  placeholder="Filter..."
                  value={resourceFilter}
                  onChange={(e) => { setResourceFilter(e.target.value); setCurrentPage(1); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th className="filterable-column">
                <div className="th-content sortable" onClick={() => handleSort('approvalStatus')}>
                  <span className="column-title-with-clear">
                    <span>Approval Status</span>
                    {approvalStatusFilter && (
                      <button className="clear-column-filter" onClick={(e) => { e.stopPropagation(); clearColumnFilter('approvalStatus'); }} title="Clear filter">✕</button>
                    )}
                  </span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'approvalStatus' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'approvalStatus' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
                <input
                  type="text"
                  className="column-filter-input"
                  placeholder="Filter..."
                  value={approvalStatusFilter}
                  onChange={(e) => { setApprovalStatusFilter(e.target.value); setCurrentPage(1); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th className="filterable-column">
                <div className="th-content sortable" onClick={() => handleSort('provisioningStatus')}>
                  <span className="column-title-with-clear">
                    <span>Provisioning</span>
                    {provisioningStatusFilter && (
                      <button className="clear-column-filter" onClick={(e) => { e.stopPropagation(); clearColumnFilter('provisioningStatus'); }} title="Clear filter">✕</button>
                    )}
                  </span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'provisioningStatus' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'provisioningStatus' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
                <input
                  type="text"
                  className="column-filter-input"
                  placeholder="Filter..."
                  value={provisioningStatusFilter}
                  onChange={(e) => { setProvisioningStatusFilter(e.target.value); setCurrentPage(1); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th className="sortable" onClick={() => handleSort('validFrom')}>
                <div className="th-content">
                  <span>Valid From</span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'validFrom' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'validFrom' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('validTo')}>
                <div className="th-content">
                  <span>Valid To</span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'validTo' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'validTo' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
              </th>
              <th className="filterable-column">
                <div className="th-content sortable" onClick={() => handleSort('reason')}>
                  <span className="column-title-with-clear">
                    <span>Reason</span>
                    {reasonFilter && (
                      <button className="clear-column-filter" onClick={(e) => { e.stopPropagation(); clearColumnFilter('reason'); }} title="Clear filter">✕</button>
                    )}
                  </span>
                  <span className="sort-indicators">
                    <span className={`sort-arrow ${sortColumn === 'reason' && sortDirection === 'asc' ? 'active' : ''}`}>▲</span>
                    <span className={`sort-arrow ${sortColumn === 'reason' && sortDirection === 'desc' ? 'active' : ''}`}>▼</span>
                  </span>
                </div>
                <input
                  type="text"
                  className="column-filter-input"
                  placeholder="Filter..."
                  value={reasonFilter}
                  onChange={(e) => { setReasonFilter(e.target.value); setCurrentPage(1); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {currentRequests.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-row">
                  {hasFilters ? 'No requests match the current filters.' : 'No access requests found.'}
                </td>
              </tr>
            ) : (
              currentRequests.map((request, index) => {
                const beneficiaryName = `${request.beneficiary?.firstName || ''} ${request.beneficiary?.lastName || ''}`.trim() || '-';
                const resourceName = request.resource?.name || '-';
                const approvalStatus = request.status?.approvalStatus || '-';
                const provisioningStatus = request.status?.provisioningStatus || '-';
                const reason = request.reason || '-';

                return (
                  <tr key={request.id || index}>
                    <td onContextMenu={(e) => handleContextMenu(e, 'beneficiary', beneficiaryName)}>
                      <div className="beneficiary-cell">
                        <span className="beneficiary-name">{beneficiaryName}</span>
                        {request.beneficiary?.identityId && (
                          <span className="beneficiary-id">{request.beneficiary.identityId}</span>
                        )}
                      </div>
                    </td>
                    <td onContextMenu={(e) => handleContextMenu(e, 'resource', resourceName)}>
                      <div className="resource-cell">
                        <span className="resource-name">{resourceName}</span>
                        {request.resource?.system?.name && (
                          <span className="system-name">{request.resource.system.name}</span>
                        )}
                      </div>
                    </td>
                    <td onContextMenu={(e) => handleContextMenu(e, 'approvalStatus', approvalStatus)}>
                      <span className={`status-badge ${getStatusBadgeClass(approvalStatus)}`}>
                        {approvalStatus}
                      </span>
                    </td>
                    <td onContextMenu={(e) => handleContextMenu(e, 'provisioningStatus', provisioningStatus)}>
                      <span className={`status-badge ${getStatusBadgeClass(provisioningStatus)}`}>
                        {provisioningStatus}
                      </span>
                    </td>
                    <td>{formatDate(request.validFrom)}</td>
                    <td>{formatDate(request.validTo)}</td>
                    <td onContextMenu={(e) => handleContextMenu(e, 'reason', reason)} className="reason-cell">
                      {reason}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedRequests.length > 0 && (
        <div className="pagination-controls">
          <div className="pagination-info">
            Showing {startIndex + 1}-{endIndex} of {filteredRequests.length} requests
            {hasFilters && <span className="filtered-text"> (filtered from {requests.length})</span>}
          </div>

          <div className="pagination-buttons">
            <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="btn btn-small" title="First page">«</button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="btn btn-small" title="Previous page">‹</button>
            <span className="page-indicator">Page {currentPage} of {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="btn btn-small" title="Next page">›</button>
            <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="btn btn-small" title="Last page">»</button>
          </div>

          <div className="page-size-selector">
            <label htmlFor="page-size">Per page:</label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="page-size-select"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessRequestsList;
