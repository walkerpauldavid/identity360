/**
 * Breadcrumbs Component
 * Shows navigation path with links back to previous pages
 */

import { Link, useLocation } from 'react-router-dom';
import './Breadcrumbs.css';

const Breadcrumbs = () => {
  const location = useLocation();

  // Route name mapping
  const routeNames = {
    '': 'Dashboard',
    'identities': 'Identities',
    'identity': 'Identity Details',
    'settings': 'Settings',
    'logs': 'API Logs',
    'my-access': 'My Access',
    'my-team': 'My Team',
    'approvals': 'Approvals',
    'access-requests': 'Access Requests',
    'assignments': 'Assignments'
  };

  // Build breadcrumb trail from current path
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't show breadcrumbs on home page
  if (pathnames.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="breadcrumb">
      <ol className="breadcrumbs-list">
        {/* Home link */}
        <li className="breadcrumb-item">
          <Link to="/">Dashboard</Link>
        </li>

        {/* Dynamic breadcrumb trail */}
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const label = routeNames[value] || value;

          return (
            <li key={to} className={`breadcrumb-item ${last ? 'active' : ''}`}>
              <span className="breadcrumb-separator">›</span>
              {last ? (
                <span className="breadcrumb-current">{label}</span>
              ) : (
                <Link to={to}>{label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
