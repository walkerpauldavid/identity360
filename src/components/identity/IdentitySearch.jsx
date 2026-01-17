/**
 * Identity Search Component
 * Example component demonstrating Omada API integration
 */

import { useState } from 'react';
import { useSearchIdentities } from '../../hooks/useOmadaApi';
import './IdentitySearch.css';

const IdentitySearch = ({ bearerToken, impersonateUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('EMAIL');
  const [filters, setFilters] = useState({});

  // Use the custom hook for identity search
  const { data, isLoading, error, refetch } = useSearchIdentities(
    filters,
    bearerToken,
    impersonateUser
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setFilters({ [searchField]: searchTerm });
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilters({});
  };

  return (
    <div className="identity-search">
      <h2>Identity Search</h2>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-controls">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className="field-select"
          >
            <option value="EMAIL">Email</option>
            <option value="DISPLAYNAME">Display Name</option>
            <option value="FIRSTNAME">First Name</option>
            <option value="LASTNAME">Last Name</option>
            <option value="DEPARTMENT">Department</option>
            <option value="JOBTITLE">Job Title</option>
          </select>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter search term..."
            className="search-input"
          />

          <button type="submit" className="btn btn-primary" disabled={!searchTerm.trim()}>
            Search
          </button>

          <button type="button" onClick={handleClear} className="btn btn-secondary">
            Clear
          </button>
        </div>
      </form>

      {isLoading && <div className="loading">Searching identities...</div>}

      {error && (
        <div className="error">
          <strong>Error:</strong> {error.message || 'Failed to search identities'}
        </div>
      )}

      {data && data.status === 'success' && (
        <div className="results">
          <div className="results-header">
            <h3>Results</h3>
            <span className="results-count">
              Found {data.total} identit{data.total === 1 ? 'y' : 'ies'}
            </span>
          </div>

          {data.data.length === 0 ? (
            <p className="no-results">No identities found matching your criteria.</p>
          ) : (
            <div className="identity-list">
              {data.data.map((identity) => (
                <div key={identity.Id || identity.UId} className="identity-card">
                  <div className="identity-header">
                    <h4>{identity.DISPLAYNAME || `${identity.FIRSTNAME} ${identity.LASTNAME}`}</h4>
                    <span className="identity-id">ID: {identity.IDENTITYID}</span>
                  </div>
                  <div className="identity-details">
                    <div className="detail-row">
                      <span className="label">Email:</span>
                      <span className="value">{identity.EMAIL}</span>
                    </div>
                    {identity.JOBTITLE && (
                      <div className="detail-row">
                        <span className="label">Job Title:</span>
                        <span className="value">{identity.JOBTITLE}</span>
                      </div>
                    )}
                    {identity.DEPARTMENT && (
                      <div className="detail-row">
                        <span className="label">Department:</span>
                        <span className="value">{identity.DEPARTMENT}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">UId:</span>
                      <span className="value uid">{identity.UId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IdentitySearch;
