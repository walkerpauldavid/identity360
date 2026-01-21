/**
 * Base Enum Definitions for Access Lens
 * Core type definitions that don't depend on any schemas
 */

// Node types in the access graph
export const NodeTypes = {
  IDENTITY: 'Identity',
  ROLE: 'Role',
  ENTITLEMENT: 'Entitlement',
  POLICY: 'Policy',
  ASSIGNMENT_POLICY: 'AssignmentPolicy',
  ACCOUNT: 'Account',
  SYSTEM: 'System',
  LOGICAL_APPLICATION: 'LogicalApplication',  // System marked as logical (has resources but no direct accounts)
  CONTEXT: 'Context'
};

// Edge/relationship types
export const EdgeTypes = {
  ASSIGNED_DIRECT: 'assigned_direct',
  INHERITED: 'inherited',
  POLICY_DRIVEN: 'policy_driven',
  LINKED_ACCOUNT: 'linked_account',
  MEMBER_OF: 'member_of',
  PROVIDES: 'provides',
  GOVERNS: 'governs'
};

// Base reason types - always shown in dropdown
export const BaseReasonTypes = {
  DIRECT: 'Direct',
  IMPLICIT: 'Implicit',
  EXPLICIT: 'Explicit'
};

// Extended reason types for entitlement effectiveness (from API)
export const ReasonTypes = {
  DIRECT: 'Direct',
  IMPLICIT: 'Implicit',
  EXPLICIT: 'Explicit',
  DIRECT_ASSIGNMENT: 'DirectAssignment',
  ROLE_MEMBERSHIP: 'RoleMembership',
  POLICY_RULE: 'PolicyRule',
  ACCOUNT_LINK: 'AccountLink',
  BIRTHRIGHT: 'Birthright',
  SOD_EXCEPTION: 'SoDException',
  OTHER: 'Other'
};

// Lane types for relationship display
export const LaneTypes = {
  ROLES: 'Roles',
  ACCOUNTS: 'Accounts',
  EFFECTIVE_ENTITLEMENTS: 'EffectiveEntitlements',
  DIRECT_ENTITLEMENTS: 'DirectEntitlements',
  POLICIES: 'Policies',
  ASSIGNMENT_POLICIES: 'AssignmentPolicies',
  SYSTEMS: 'Systems',
  LOGICAL_APPLICATIONS: 'LogicalApplications',
  IDENTITIES: 'Identities',
  CONTEXTS: 'Contexts'
};

// View modes
export const ViewModes = {
  EXPLORE: 'explore',
  RISK: 'risk',
  REVIEW: 'review'
};

// Action types for state changes
export const ActionTypes = {
  SELECT: 'select',
  PIVOT: 'pivot',
  EXPAND: 'expand',
  COLLAPSE: 'collapse',
  FILTER: 'filter',
  EXPLAIN: 'explain',
  CERTIFY: 'certify',
  REVIEW: 'review'
};

// Compass orientations for lane positioning
export const CompassOrientation = {
  N: 'N',
  NE: 'NE',
  E: 'E',
  SE: 'SE',
  S: 'S',
  SW: 'SW',
  W: 'W',
  NW: 'NW'
};

// Cross-lane filter relationship types
export const CrossLaneFilterType = {
  FIELD_MATCH: 'fieldMatch',
  ARRAY_CONTAINS: 'arrayContains',
  MULTI_FIELD_MATCH: 'multiFieldMatch',
  CASCADED_THROUGH: 'cascadedThrough'
};

// Lane display rules
export const LaneDisplayRules = {
  SINGLE_COLUMN: {
    columns: 1,
    width: 350,
    maxVisibleItems: 10
  },
  MULTI_COLUMN: {
    columns: 2,
    width: 700,
    maxVisibleItems: 20
  },
  THREE_COLUMN: {
    columns: 3,
    width: 1050,
    maxVisibleItems: 30
  }
};
