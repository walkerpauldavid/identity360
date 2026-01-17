/**
 * My Access Page
 * Displays the current user's access rights and permissions
 */

import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../layout/Navbar';
import Breadcrumbs from '../layout/Breadcrumbs';
import './MyAccess.css';

const MyAccess = () => {
  const { user } = useAuth();

  return (
    <div className="my-access-page">
      <Navbar title="My Access" />
      <Breadcrumbs />

      <div className="my-access-content">
        <div className="page-header">
          <div className="header-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
          </div>
          <div>
            <h1>My Access Rights</h1>
            <p className="page-subtitle">View your permissions and access levels in the system</p>
          </div>
        </div>

        {/* User Information */}
        <div className="access-section">
          <h2 className="section-title">User Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user?.email || 'Not available'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Display Name:</span>
              <span className="info-value">{user?.info?.displayName || user?.email || 'Not available'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">User Type:</span>
              <span className="info-value">Identity Administrator</span>
            </div>
          </div>
        </div>

        {/* System Permissions */}
        <div className="access-section">
          <h2 className="section-title">System Permissions</h2>
          <div className="permissions-grid">
            <div className="permission-card">
              <div className="permission-icon granted">✓</div>
              <h3>View Identities</h3>
              <p>Read access to identity records</p>
            </div>
            <div className="permission-card">
              <div className="permission-icon granted">✓</div>
              <h3>Manage Access Requests</h3>
              <p>Create and view access requests</p>
            </div>
            <div className="permission-card">
              <div className="permission-icon granted">✓</div>
              <h3>View Approvals</h3>
              <p>View pending approval items</p>
            </div>
            <div className="permission-card">
              <div className="permission-icon granted">✓</div>
              <h3>View Assignments</h3>
              <p>Read access to calculated assignments</p>
            </div>
            <div className="permission-card">
              <div className="permission-icon granted">✓</div>
              <h3>API Access</h3>
              <p>Access to OData and GraphQL APIs</p>
            </div>
            <div className="permission-card">
              <div className="permission-icon granted">✓</div>
              <h3>View Logs</h3>
              <p>Access to API logs and debugging</p>
            </div>
          </div>
        </div>

        {/* OAuth Scopes */}
        <div className="access-section">
          <h2 className="section-title">OAuth Scopes</h2>
          <div className="scopes-list">
            <div className="scope-item">
              <span className="scope-badge">https://graph.microsoft.com/.default</span>
              <span className="scope-description">Microsoft Graph API access</span>
            </div>
            <div className="scope-item">
              <span className="scope-badge">offline_access</span>
              <span className="scope-description">Refresh token support</span>
            </div>
          </div>
        </div>

        {/* Access Level Notice */}
        <div className="access-notice">
          <div className="notice-icon">ℹ️</div>
          <div>
            <strong>Note:</strong> Your access rights are managed by your organization's identity administrators.
            If you need additional permissions, please contact your IT support team.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAccess;
