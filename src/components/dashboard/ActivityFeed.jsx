/**
 * Activity Feed Component
 * Displays recent governance events in a side panel
 */

import { useState, useEffect } from 'react';
import { generateActivityFeed, formatEventTime } from '../../utils/activityGenerator';
import './ActivityFeed.css';

const ActivityFeed = ({ isOpen, onClose }) => {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all'); // all, access, requests, users

  useEffect(() => {
    // Generate sample events on mount
    const sampleEvents = generateActivityFeed(50);
    setEvents(sampleEvents);
  }, []);

  // Filter events based on selected filter
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'access') {
      return event.type === 'GRANT_ACCESS' || event.type === 'REVOKE_ACCESS';
    }
    if (filter === 'requests') {
      return event.type === 'REQUEST_CREATED' || event.type === 'REQUEST_CANCELLED' ||
             event.type === 'APPROVAL_GRANTED' || event.type === 'APPROVAL_DENIED';
    }
    if (filter === 'users') {
      return event.type === 'USER_ONBOARDED' || event.type === 'USER_OFFBOARDED' ||
             event.type === 'ROLE_ASSIGNED' || event.type === 'ROLE_REMOVED';
    }
    return true;
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="activity-feed-backdrop" onClick={onClose} />}

      {/* Side Panel */}
      <div className={`activity-feed-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="activity-feed-header">
          <div className="header-content">
            <h2>
              <span className="activity-icon">📊</span>
              Recent Activity
            </h2>
            <button className="close-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>

          {/* Filters */}
          <div className="activity-filters">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'access' ? 'active' : ''}`}
              onClick={() => setFilter('access')}
            >
              Access
            </button>
            <button
              className={`filter-btn ${filter === 'requests' ? 'active' : ''}`}
              onClick={() => setFilter('requests')}
            >
              Requests
            </button>
            <button
              className={`filter-btn ${filter === 'users' ? 'active' : ''}`}
              onClick={() => setFilter('users')}
            >
              Users
            </button>
          </div>
        </div>

        {/* Events List */}
        <div className="activity-feed-content">
          {filteredEvents.length === 0 ? (
            <div className="empty-state">
              <p>No activity to display</p>
            </div>
          ) : (
            <div className="events-list">
              {filteredEvents.map(event => (
                <div key={event.id} className={`event-item severity-${event.severity}`}>
                  <div className="event-icon" style={{ backgroundColor: event.color }}>
                    {event.icon}
                  </div>
                  <div className="event-content">
                    <div className="event-header">
                      <span className="event-title">{event.title}</span>
                      <span className="event-time">{formatEventTime(event.timestamp)}</span>
                    </div>
                    <p className="event-description">{event.description}</p>

                    {/* Event Details */}
                    <div className="event-details">
                      {Object.entries(event.details).map(([key, value]) => (
                        <div key={key} className="detail-item">
                          <span className="detail-label">{key}:</span>
                          <span className="detail-value">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Full Timestamp */}
                    <div className="event-timestamp">
                      {event.timestamp.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="activity-feed-footer">
          <p className="footer-text">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>
      </div>
    </>
  );
};

export default ActivityFeed;
