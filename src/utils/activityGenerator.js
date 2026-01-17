/**
 * Activity Feed Event Generator
 * Generates simulated governance events with realistic data
 */

// Sample data pools
const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

const RESOURCES = [
  { name: 'SAP Finance', type: 'Application' },
  { name: 'Salesforce CRM', type: 'Application' },
  { name: 'HR Portal', type: 'Application' },
  { name: 'Admin Dashboard', type: 'Application' },
  { name: 'VPN Access', type: 'Network' },
  { name: 'Finance Folder', type: 'File Share' },
  { name: 'Marketing Drive', type: 'File Share' },
  { name: 'Engineering Repository', type: 'Repository' },
  { name: 'Customer Database', type: 'Database' },
  { name: 'Payment Gateway', type: 'System' }
];

const ROLES = [
  'Finance Manager',
  'HR Administrator',
  'Sales Representative',
  'IT Administrator',
  'Department Manager',
  'Project Lead',
  'Security Officer',
  'Auditor',
  'Developer',
  'Business Analyst'
];

const DEPARTMENTS = [
  'Finance',
  'Human Resources',
  'Sales',
  'Marketing',
  'IT',
  'Operations',
  'Legal',
  'Customer Service',
  'Engineering',
  'Product'
];

// Event type definitions
const EVENT_TYPES = {
  GRANT_ACCESS: 'GRANT_ACCESS',
  REVOKE_ACCESS: 'REVOKE_ACCESS',
  REQUEST_CREATED: 'REQUEST_CREATED',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  USER_ONBOARDED: 'USER_ONBOARDED',
  USER_OFFBOARDED: 'USER_OFFBOARDED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REMOVED: 'ROLE_REMOVED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_DENIED: 'APPROVAL_DENIED'
};

/**
 * Generate a random user name
 */
const generateUserName = () => {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
};

/**
 * Generate a random timestamp within the last N days
 */
const generateTimestamp = (daysBack = 7) => {
  const now = new Date();
  const randomDaysBack = Math.random() * daysBack;
  const randomHoursBack = Math.random() * 24;
  const randomMinutesBack = Math.random() * 60;

  const timestamp = new Date(
    now.getTime() -
    (randomDaysBack * 24 * 60 * 60 * 1000) -
    (randomHoursBack * 60 * 60 * 1000) -
    (randomMinutesBack * 60 * 1000)
  );

  return timestamp;
};

/**
 * Generate a single random event
 */
const generateEvent = () => {
  const eventTypeKeys = Object.keys(EVENT_TYPES);
  const eventType = EVENT_TYPES[eventTypeKeys[Math.floor(Math.random() * eventTypeKeys.length)]];
  const user = generateUserName();
  const resource = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
  const role = ROLES[Math.floor(Math.random() * ROLES.length)];
  const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
  const approver = generateUserName();
  const timestamp = generateTimestamp(7); // Last 7 days

  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  switch (eventType) {
    case EVENT_TYPES.GRANT_ACCESS:
      return {
        id: eventId,
        type: eventType,
        icon: '✅',
        color: '#4caf50',
        title: 'Access Granted',
        description: `${user} was granted access to ${resource.name}`,
        details: {
          user,
          resource: resource.name,
          resourceType: resource.type,
          grantedBy: approver
        },
        timestamp,
        severity: 'info'
      };

    case EVENT_TYPES.REVOKE_ACCESS:
      return {
        id: eventId,
        type: eventType,
        icon: '🚫',
        color: '#f44336',
        title: 'Access Revoked',
        description: `${user}'s access to ${resource.name} was removed`,
        details: {
          user,
          resource: resource.name,
          resourceType: resource.type,
          revokedBy: approver
        },
        timestamp,
        severity: 'warning'
      };

    case EVENT_TYPES.REQUEST_CREATED:
      return {
        id: eventId,
        type: eventType,
        icon: '📝',
        color: '#2196f3',
        title: 'Access Request Created',
        description: `${user} requested access to ${resource.name}`,
        details: {
          user,
          resource: resource.name,
          resourceType: resource.type,
          status: 'Pending'
        },
        timestamp,
        severity: 'info'
      };

    case EVENT_TYPES.REQUEST_CANCELLED:
      return {
        id: eventId,
        type: eventType,
        icon: '❌',
        color: '#ff9800',
        title: 'Request Cancelled',
        description: `${user} cancelled their request for ${resource.name}`,
        details: {
          user,
          resource: resource.name,
          resourceType: resource.type
        },
        timestamp,
        severity: 'info'
      };

    case EVENT_TYPES.USER_ONBOARDED:
      return {
        id: eventId,
        type: eventType,
        icon: '🎉',
        color: '#4caf50',
        title: 'User Onboarded',
        description: `${user} joined ${department} department`,
        details: {
          user,
          department,
          role,
          startDate: timestamp.toLocaleDateString()
        },
        timestamp,
        severity: 'success'
      };

    case EVENT_TYPES.USER_OFFBOARDED:
      return {
        id: eventId,
        type: eventType,
        icon: '👋',
        color: '#9e9e9e',
        title: 'User Offboarded',
        description: `${user} left the organization`,
        details: {
          user,
          department,
          terminationDate: timestamp.toLocaleDateString()
        },
        timestamp,
        severity: 'warning'
      };

    case EVENT_TYPES.ROLE_ASSIGNED:
      return {
        id: eventId,
        type: eventType,
        icon: '👤',
        color: '#9c27b0',
        title: 'Role Assigned',
        description: `${user} was assigned role: ${role}`,
        details: {
          user,
          role,
          assignedBy: approver
        },
        timestamp,
        severity: 'info'
      };

    case EVENT_TYPES.ROLE_REMOVED:
      return {
        id: eventId,
        type: eventType,
        icon: '👥',
        color: '#ff5722',
        title: 'Role Removed',
        description: `${role} was removed from ${user}`,
        details: {
          user,
          role,
          removedBy: approver
        },
        timestamp,
        severity: 'warning'
      };

    case EVENT_TYPES.APPROVAL_GRANTED:
      return {
        id: eventId,
        type: eventType,
        icon: '✓',
        color: '#4caf50',
        title: 'Approval Granted',
        description: `${approver} approved ${user}'s request for ${resource.name}`,
        details: {
          approver,
          user,
          resource: resource.name,
          resourceType: resource.type
        },
        timestamp,
        severity: 'success'
      };

    case EVENT_TYPES.APPROVAL_DENIED:
      return {
        id: eventId,
        type: eventType,
        icon: '✗',
        color: '#f44336',
        title: 'Approval Denied',
        description: `${approver} denied ${user}'s request for ${resource.name}`,
        details: {
          approver,
          user,
          resource: resource.name,
          resourceType: resource.type,
          reason: 'Does not meet security requirements'
        },
        timestamp,
        severity: 'error'
      };

    default:
      return null;
  }
};

/**
 * Generate multiple events
 * @param {number} count - Number of events to generate
 * @returns {Array} Array of events sorted by timestamp (newest first)
 */
export const generateActivityFeed = (count = 50) => {
  const events = [];

  for (let i = 0; i < count; i++) {
    const event = generateEvent();
    if (event) {
      events.push(event);
    }
  }

  // Sort by timestamp, newest first
  events.sort((a, b) => b.timestamp - a.timestamp);

  return events;
};

/**
 * Format timestamp for display
 */
export const formatEventTime = (timestamp) => {
  const now = new Date();
  const eventDate = new Date(timestamp);
  const diffMs = now - eventDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return eventDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: eventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};

export default generateActivityFeed;
