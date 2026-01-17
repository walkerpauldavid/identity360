/**
 * My Team Component
 * Shows team members and their access rights
 */

import { useState } from 'react';
import Navbar from '../layout/Navbar';
import Breadcrumbs from '../layout/Breadcrumbs';
import './MyTeam.css';

const MyTeam = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, pending

  // Mock team data
  const teamMembers = [
    {
      id: 1,
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      role: 'Senior Developer',
      status: 'Active',
      accessCount: 12,
      pendingRequests: 0,
      lastActivity: '2 hours ago',
      applications: ['SAP Finance', 'Salesforce', 'VPN Access']
    },
    {
      id: 2,
      name: 'Michael Rodriguez',
      email: 'michael.r@company.com',
      role: 'Product Manager',
      status: 'Active',
      accessCount: 8,
      pendingRequests: 2,
      lastActivity: '1 day ago',
      applications: ['Salesforce', 'Marketing Drive', 'Analytics']
    },
    {
      id: 3,
      name: 'Emily Watson',
      email: 'emily.w@company.com',
      role: 'UX Designer',
      status: 'Active',
      accessCount: 6,
      pendingRequests: 0,
      lastActivity: '3 hours ago',
      applications: ['Figma', 'Marketing Drive']
    },
    {
      id: 4,
      name: 'David Kim',
      email: 'david.kim@company.com',
      role: 'DevOps Engineer',
      status: 'Active',
      accessCount: 15,
      pendingRequests: 1,
      lastActivity: '30 minutes ago',
      applications: ['AWS Console', 'VPN Access', 'GitHub Enterprise']
    },
    {
      id: 5,
      name: 'Jessica Martinez',
      email: 'jessica.m@company.com',
      role: 'Data Analyst',
      status: 'Active',
      accessCount: 9,
      pendingRequests: 0,
      lastActivity: '5 hours ago',
      applications: ['Tableau', 'Customer Database', 'Analytics']
    },
    {
      id: 6,
      name: 'Alex Thompson',
      email: 'alex.t@company.com',
      role: 'QA Engineer',
      status: 'Active',
      accessCount: 7,
      pendingRequests: 1,
      lastActivity: '1 hour ago',
      applications: ['JIRA', 'Testing Environment']
    },
    {
      id: 7,
      name: 'Rachel Green',
      email: 'rachel.g@company.com',
      role: 'Junior Developer',
      status: 'Pending',
      accessCount: 3,
      pendingRequests: 4,
      lastActivity: '2 days ago',
      applications: ['VPN Access', 'GitHub']
    },
    {
      id: 8,
      name: 'James Wilson',
      email: 'james.w@company.com',
      role: 'Business Analyst',
      status: 'Active',
      accessCount: 10,
      pendingRequests: 0,
      lastActivity: '4 hours ago',
      applications: ['SAP Finance', 'Salesforce', 'Tableau']
    }
  ];

  // Filter team members
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.role.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'pending') {
      return matchesSearch && member.pendingRequests > 0;
    }
    if (filterStatus === 'active') {
      return matchesSearch && member.status === 'Active';
    }
    return matchesSearch;
  });

  return (
    <div className="app-container">
      <Navbar title="My Team" />
      <Breadcrumbs />
      <div className="main-content">
        <div className="my-team-page">
          {/* Header */}
          <div className="team-header">
            <div className="header-info">
              <h1>My Team</h1>
              <p className="subtitle">{teamMembers.length} team members</p>
            </div>
          </div>

          {/* Controls */}
          <div className="team-controls">
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <button
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active
              </button>
              <button
                className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                Pending Requests
              </button>
            </div>
          </div>

          {/* Team Table */}
          <div className="team-table-container">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Access</th>
                  <th>Pending</th>
                  <th>Applications</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-info">
                        <div className="member-avatar">{member.name.charAt(0)}</div>
                        <div className="member-details">
                          <span className="member-name">{member.name}</span>
                          <span className="member-email">{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="role-badge">{member.role}</span></td>
                    <td>
                      <span className={`status-badge ${member.status.toLowerCase()}`}>
                        {member.status}
                      </span>
                    </td>
                    <td><span className="count-badge">{member.accessCount}</span></td>
                    <td>
                      {member.pendingRequests > 0 ? (
                        <span className="pending-badge">{member.pendingRequests}</span>
                      ) : (
                        <span className="no-pending">—</span>
                      )}
                    </td>
                    <td>
                      <div className="app-list">
                        {member.applications.slice(0, 2).map((app, idx) => (
                          <span key={idx} className="app-tag">{app}</span>
                        ))}
                        {member.applications.length > 2 && (
                          <span className="app-more">+{member.applications.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td><span className="last-activity">{member.lastActivity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="team-summary">
            <div className="summary-item">
              <span className="summary-label">Total Members:</span>
              <span className="summary-value">{filteredMembers.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Pending Requests:</span>
              <span className="summary-value">
                {filteredMembers.reduce((sum, m) => sum + m.pendingRequests, 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Access Rights:</span>
              <span className="summary-value">
                {filteredMembers.reduce((sum, m) => sum + m.accessCount, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTeam;
