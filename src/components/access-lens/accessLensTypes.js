/**
 * AccessLens Type Definitions
 * Types for the IGA access graph exploration widget
 */

// Node types in the access graph
export const NodeTypes = {
  IDENTITY: 'Identity',
  ROLE: 'Role',
  ENTITLEMENT: 'Entitlement',
  POLICY: 'Policy',
  ACCOUNT: 'Account',
  SYSTEM: 'System',
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
  SYSTEMS: 'Systems',
  LOGICAL_APPLICATIONS: 'LogicalApplications',  // Logical systems that have resources but no direct accounts
  IDENTITIES: 'Identities',
  CONTEXTS: 'Contexts'
};

// ============================================================================
// LANE SCHEMA - Defines display rules based on data type
// ============================================================================

/**
 * Display rules by data type:
 * - SINGLE_COLUMN: System, Account, Context, Identity, Role, Policy (1 column, 350px)
 * - MULTI_COLUMN: Entitlement (2 columns, 700px)
 */
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
  }
};

/**
 * Compass orientations for lane positioning relative to central node
 * Used to determine default positions when layout is reset
 */
export const CompassOrientation = {
  N: 'N',     // North - top center
  NE: 'NE',   // North-East - top right
  E: 'E',     // East - right center
  SE: 'SE',   // South-East - bottom right
  S: 'S',     // South - bottom center
  SW: 'SW',   // South-West - bottom left
  W: 'W',     // West - left center
  NW: 'NW'    // North-West - top left
};

/**
 * Lane Schema - Single source of truth for lane configuration
 * Each lane type is mapped to its data type and display characteristics
 *
 * defaultPosition.compass - Compass orientation relative to central node (N, NE, E, SE, S, SW, W, NW)
 * defaultPosition.priority - Lower number = placed first when multiple lanes share same orientation
 */
export const LaneSchema = {
  [LaneTypes.SYSTEMS]: {
    dataType: NodeTypes.SYSTEM,
    displayRule: 'SINGLE_COLUMN',
    icon: '🖥️',
    color: '#d08770',
    label: 'Systems',
    description: 'Systems this identity has access to',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.SE,  // South-East
      priority: 1
    },
    // OData API configuration for fetching full object details
    apiSource: {
      type: 'OData',
      endpoint: 'System',
      filterField: 'Name',  // Field to use in OData $filter (e.g., Name eq 'value')
      idField: 'Id'
    },
    // Inspector configuration - which attributes to show/hide
    inspectorConfig: {
      showAttributes: [
        { field: 'Name', label: 'Name', type: 'text' },
        { field: 'DisplayName', label: 'Display Name', type: 'text' },
        { field: 'Description', label: 'Description', type: 'text' },
        { field: 'ABORESSION', label: 'Abo Ressen', type: 'text' },
        { field: 'ALTERNATIVEID', label: 'Alternative ID', type: 'text' },
        { field: 'CONNECTIONSTRING', label: 'Connection String', type: 'text' },
        { field: 'CONNECTIONTYPE', label: 'Connection Type', type: 'reference' },
        { field: 'CREATEDTIME', label: 'Created Time', type: 'datetime' },
        { field: 'LASTSYNCTIME', label: 'Last Sync Time', type: 'datetime' },
        { field: 'STATUS', label: 'Status', type: 'reference' },
        { field: 'SYSTEMCATEGORY', label: 'System Category', type: 'reference' },
        { field: 'SYSTEMTYPE', label: 'System Type', type: 'reference' }
      ],
      hideAttributes: ['Id', 'UId', 'C_ABORESSION']  // Internal/technical fields to hide
    }
  },
  [LaneTypes.LOGICAL_APPLICATIONS]: {
    dataType: NodeTypes.SYSTEM,  // Still a system type, but logical
    displayRule: 'SINGLE_COLUMN',
    icon: '☁️',  // Cloud icon to represent logical/virtual application
    color: '#8fbcbb',  // Teal color to distinguish from physical systems
    label: 'Logical Applications',
    description: 'Logical applications with resources but no direct accounts (implemented via other systems)',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.E,  // East - as requested
      priority: 1
    },
    apiSource: {
      type: 'derived',  // Derived from assignments, not fetched directly
      derivedFrom: 'calculatedAssignments'
    }
  },
  [LaneTypes.ACCOUNTS]: {
    dataType: NodeTypes.ACCOUNT,
    displayRule: 'SINGLE_COLUMN',
    icon: '💻',
    color: '#bf616a',
    label: 'Accounts',
    description: 'Accounts linked to this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.NE,  // North-East
      priority: 1
    },
    // Default sort configuration
    defaultSort: {
      field: 'displayName',  // Sort by account name
      order: 'asc'           // Ascending (alphabetical A-Z)
    },
    // Cross-lane filtering configuration
    // When this lane is clicked, filter these other lanes
    crossLaneFilters: {
      [LaneTypes.IDENTITIES]: {
        filterField: 'identity.id',      // Field in this item that identifies related identity
        targetField: 'id'                 // Field in Identities lane to match against
      },
      [LaneTypes.SYSTEMS]: {
        filterField: 'system.id',
        targetField: 'id'
      }
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Account',
      filterField: 'AccountName',  // Field to use in OData $filter
      idField: 'Id',
      selectFields: 'Id,AccountName,DisplayName,Description,AccountType,SystemRef,IdentityRef,Status,LastLogin,Created'
    }
  },
  [LaneTypes.CONTEXTS]: {
    dataType: NodeTypes.CONTEXT,
    displayRule: 'SINGLE_COLUMN',
    icon: '🏷️',
    color: '#5e81ac',
    label: 'Contexts',
    description: 'Organizational contexts for this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.SW,  // South-West
      priority: 1
    },
    apiSource: {
      type: 'GraphQL',
      query: 'getContextById',
      idField: 'id'
    }
  },
  [LaneTypes.IDENTITIES]: {
    dataType: NodeTypes.IDENTITY,
    displayRule: 'SINGLE_COLUMN',
    icon: '👤',
    color: '#88c0d0',
    label: 'Identities',
    description: 'Related identities',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.W,  // West (for system-centric view)
      priority: 1
    },
    // Cross-lane filtering configuration
    // When this lane is clicked, filter these other lanes
    crossLaneFilters: {
      [LaneTypes.ACCOUNTS]: {
        filterField: 'id',                // Field in this item (identity.id)
        targetField: 'identity.id'        // Field in Accounts lane to match against
      }
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Identity',
      filterField: 'DISPLAYNAME',  // Field to use in OData $filter
      idField: 'UId',
      selectFields: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL'
    }
  },
  [LaneTypes.ROLES]: {
    dataType: NodeTypes.ROLE,
    displayRule: 'SINGLE_COLUMN',
    icon: '👥',
    color: '#a3be8c',
    label: 'Roles',
    description: 'Roles assigned to this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.E,  // East
      priority: 1
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Role',
      filterField: 'Name',  // Field to use in OData $filter
      idField: 'UId',
      selectFields: 'UId,Id,DisplayName,Name,Description,RoleType,MemberCount,EntitlementCount,Status,RiskScore'
    }
  },
  [LaneTypes.POLICIES]: {
    dataType: NodeTypes.POLICY,
    displayRule: 'SINGLE_COLUMN',
    icon: '📋',
    color: '#b48ead',
    label: 'Policies',
    description: 'Policies governing this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.S,  // South
      priority: 1
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Policy',
      filterField: 'Name',  // Field to use in OData $filter
      idField: 'Id',
      selectFields: 'Id,Name,DisplayName,Description,PolicyType,Scope,Status'
    }
  },
  [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
    dataType: NodeTypes.ENTITLEMENT,
    displayRule: 'MULTI_COLUMN',
    icon: '🔑',
    color: '#ebcb8b',
    label: 'Effective Entitlements',
    description: 'All effective entitlements for this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [
      {
        // Exclude default account resources
        fields: ['resource.name', 'resource.description', 'resource.resourceType.name'],
        values: ['default account resource']
      },
      {
        // Exclude account-type resources - these belong in the Accounts lane, not Entitlements
        fields: ['resource.resourceType.name', 'resource.resourceCategory.name'],
        values: ['account', 'administrative account', 'user account', 'service account']
      }
    ],
    defaultPosition: {
      compass: CompassOrientation.NW,  // North-West (primary entitlements lane)
      priority: 1
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Resource',
      filterField: 'Name',  // Field to use in OData $filter
      idField: 'Id',
      selectFields: 'Id,Name,DisplayName,Description,ResourceType,SystemRef,Status,RiskScore'
    },
    // Inspector configuration - hide technical/internal fields
    inspectorConfig: {
      hideAttributes: ['id', 'Id', 'ID', 'system.id', 'systemId', 'SystemId', 'resourceType.id', 'resourceCategory.id', 'resourceFolder.id']
    }
  },
  [LaneTypes.DIRECT_ENTITLEMENTS]: {
    dataType: NodeTypes.ENTITLEMENT,
    displayRule: 'MULTI_COLUMN',
    icon: '🔑',
    color: '#ebcb8b',
    label: 'Direct Entitlements',
    description: 'Directly assigned entitlements',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.N,  // North (top center)
      priority: 1
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Resource',
      filterField: 'Name',  // Field to use in OData $filter
      idField: 'Id',
      selectFields: 'Id,Name,DisplayName,Description,ResourceType,SystemRef,Status,RiskScore'
    }
  }
};

/**
 * Get computed lane display config by resolving the schema and display rules
 * This is the primary method for getting lane configuration
 */
export const getLaneDisplayConfig = (laneType) => {
  const schema = LaneSchema[laneType];

  if (!schema) {
    // Default fallback for unknown lane types
    return {
      dataType: null,
      displayRule: 'SINGLE_COLUMN',
      columns: 1,
      width: 350,
      maxVisibleItems: 10,
      sortable: true,
      collapsible: true,
      icon: '📦',
      color: '#4c566a',
      label: laneType,
      description: '',
      exclusionList: []
    };
  }

  // Get display rules based on the schema's displayRule
  const displayRules = LaneDisplayRules[schema.displayRule] || LaneDisplayRules.SINGLE_COLUMN;

  // Merge schema with computed display rules
  return {
    ...schema,
    columns: displayRules.columns,
    width: displayRules.width,
    maxVisibleItems: schema.maxVisibleItems || displayRules.maxVisibleItems
  };
};

// Legacy export for backwards compatibility
export const LaneDisplayConfig = Object.keys(LaneSchema).reduce((acc, laneType) => {
  acc[laneType] = getLaneDisplayConfig(laneType);
  return acc;
}, {});

// View modes
export const ViewModes = {
  EXPLORE: 'explore',
  RISK: 'risk',
  REVIEW: 'review'
};

// Get icon for node type
export const getNodeIcon = (type) => {
  switch (type) {
    case NodeTypes.IDENTITY: return '👤';
    case NodeTypes.ROLE: return '👥';
    case NodeTypes.ENTITLEMENT: return '🔑';
    case NodeTypes.POLICY: return '📋';
    case NodeTypes.ACCOUNT: return '💻';
    case NodeTypes.SYSTEM: return '🖥️';
    case NodeTypes.CONTEXT: return '🏷️';
    default: return '📦';
  }
};

// Get color for node type
export const getNodeColor = (type) => {
  switch (type) {
    case NodeTypes.IDENTITY: return '#88c0d0';
    case NodeTypes.ROLE: return '#a3be8c';
    case NodeTypes.ENTITLEMENT: return '#ebcb8b';
    case NodeTypes.POLICY: return '#b48ead';
    case NodeTypes.ACCOUNT: return '#bf616a';
    case NodeTypes.SYSTEM: return '#d08770';
    case NodeTypes.CONTEXT: return '#5e81ac';
    default: return '#4c566a';
  }
};

// Get color for reason type
export const getReasonColor = (type) => {
  switch (type) {
    case ReasonTypes.DIRECT_ASSIGNMENT: return '#88c0d0';
    case ReasonTypes.ROLE_MEMBERSHIP: return '#a3be8c';
    case ReasonTypes.POLICY_RULE: return '#b48ead';
    case ReasonTypes.ACCOUNT_LINK: return '#bf616a';
    case ReasonTypes.BIRTHRIGHT: return '#ebcb8b';
    case ReasonTypes.SOD_EXCEPTION: return '#d08770';
    default: return '#4c566a';
  }
};

// Get status color
export const getStatusColor = (status) => {
  switch (status) {
    case 'active': return '#a3be8c';
    case 'disabled': return '#bf616a';
    case 'stale': return '#ebcb8b';
    default: return '#4c566a';
  }
};

// Get risk color based on score
export const getRiskColor = (score) => {
  if (score >= 80) return '#bf616a';
  if (score >= 50) return '#d08770';
  if (score >= 30) return '#ebcb8b';
  return '#a3be8c';
};

// ============================================================================
// FOCUS NODE SCHEMA - Defines display attributes for each object type
// ============================================================================

/**
 * Schema for what attributes to display in the central lane (fulcrum)
 * for each object type. Each attribute has:
 * - field: The API field name(s) to use (supports fallbacks with |)
 * - label: Display label
 * - type: 'text', 'email', 'badge', 'status', 'risk', 'date'
 * - required: Whether this field must be shown
 */
export const FocusNodeSchema = {
  [NodeTypes.IDENTITY]: {
    title: 'Identity',
    icon: '👤',
    primaryField: 'DISPLAYNAME|FIRSTNAME+LASTNAME',
    attributes: [
      { field: 'EMAIL', label: 'Email', type: 'email', required: true },
      { field: 'JOBTITLE', label: 'Title', type: 'text', required: false },
      { field: 'EMPLOYEEID', label: 'Employee ID', type: 'text', required: false },
      { field: 'OUREF.DisplayName|OUREF', label: 'Department', type: 'text', required: false },
      { field: 'IDENTITYCATEGORY', label: 'Category', type: 'badge', required: false },
      { field: 'IDENTITYSTATUS', label: 'Status', type: 'status', required: true },
      { field: 'RISKLEVEL', label: 'Risk', type: 'risk', required: false }
    ],
    apiSource: {
      type: 'OData',
      endpoint: 'Identity',
      idField: 'UId',
      // Note: DESCRIPTION is not available on Identity entity type
      selectFields: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL'
    }
  },

  [NodeTypes.ROLE]: {
    title: 'Role',
    icon: '👥',
    primaryField: 'DisplayName|Name',
    attributes: [
      { field: 'Description', label: 'Description', type: 'text', required: false },
      { field: 'RoleType', label: 'Type', type: 'badge', required: false },
      { field: 'MemberCount', label: 'Members', type: 'text', required: false },
      { field: 'EntitlementCount', label: 'Entitlements', type: 'text', required: false },
      { field: 'Status', label: 'Status', type: 'status', required: true },
      { field: 'RiskScore', label: 'Risk', type: 'risk', required: false }
    ],
    apiSource: {
      type: 'OData',
      endpoint: 'Role',
      idField: 'UId',
      selectFields: 'UId,Id,DisplayName,Name,Description,RoleType,MemberCount,EntitlementCount,Status,RiskScore'
    }
  },

  [NodeTypes.ACCOUNT]: {
    title: 'Account',
    icon: '💻',
    primaryField: 'AccountName|DisplayName|Name',
    attributes: [
      { field: 'System.Name|SystemName', label: 'System', type: 'badge', required: true },
      { field: 'AccountType.Name|AccountType', label: 'Type', type: 'badge', required: false },
      { field: 'Identity.DisplayName', label: 'Owner', type: 'text', required: false },
      { field: 'LastLogin', label: 'Last Login', type: 'date', required: false },
      { field: 'Status', label: 'Status', type: 'status', required: true }
    ],
    apiSource: {
      type: 'GraphQL',
      query: 'getAccountById',
      idField: 'id'
    }
  },

  [NodeTypes.ENTITLEMENT]: {
    title: 'Entitlement',
    icon: '🔑',
    primaryField: 'Name|DisplayName',
    // Note: System and Type are shown as badges, so they're excluded from attributes to avoid duplication
    // Note: Compliance is shown separately when an Identity is selected, not as a schema attribute
    attributes: [
      { field: 'Description|description', label: 'Description', type: 'text', required: false },
      { field: 'Status', label: 'Status', type: 'status', required: true },
      { field: 'RiskScore', label: 'Risk', type: 'risk', required: false },
      { field: 'validFrom|ValidFrom', label: 'Valid From', type: 'date', required: false },
      { field: 'validTo|ValidTo', label: 'Valid To', type: 'date', required: false }
    ],
    apiSource: {
      type: 'GraphQL',
      query: 'getResourceById',
      idField: 'id'
    },
    // Hide internal IDs and fields that duplicate badges when Entitlement is the central node
    // System name and Resource Type are shown as badges, so hide them from attributes
    inspectorConfig: {
      hideAttributes: [
        // IDs - internal/technical
        'id', 'Id', 'ID',
        'systemId', 'SystemId', 'system.id',
        'resourceTypeId', 'ResourceTypeId', 'resourceType.id',
        'resourceCategoryId', 'resourceCategory.id',
        'resourceFolderId', 'resourceFolder.id',
        // System - already shown as badge
        'system', 'System', 'system.name', 'systemName', 'SystemName',
        // Resource Type - already shown as badge
        'resourceType', 'ResourceType', 'resourceType.name', 'resourceTypeName', 'ResourceTypeName', 'type', 'Type'
      ]
    }
  },

  [NodeTypes.SYSTEM]: {
    title: 'System',
    icon: '🖥️',
    primaryField: 'Name|DisplayName',
    attributes: [
      { field: 'Description', label: 'Description', type: 'text', required: false },
      { field: 'Vendor', label: 'Vendor', type: 'text', required: false },
      { field: 'Category', label: 'Category', type: 'badge', required: false },
      { field: 'AccountCount', label: 'Accounts', type: 'text', required: false },
      { field: 'Status', label: 'Status', type: 'status', required: true }
    ],
    apiSource: {
      type: 'OData',
      endpoint: 'System',
      idField: 'Id',
      selectFields: 'Id,Name,DisplayName,Description,Vendor,Category,Status'
    }
  },

  [NodeTypes.CONTEXT]: {
    title: 'Context',
    icon: '🏷️',
    primaryField: 'displayName|name|Name',
    attributes: [
      { field: 'type|Type', label: 'Type', type: 'badge', required: false },
      { field: 'description|Description', label: 'Description', type: 'text', required: false }
    ],
    apiSource: {
      type: 'GraphQL',
      query: 'getContextById',
      idField: 'id'
    }
  },

  [NodeTypes.POLICY]: {
    title: 'Policy',
    icon: '📋',
    primaryField: 'Name|DisplayName',
    attributes: [
      { field: 'Description', label: 'Description', type: 'text', required: false },
      { field: 'Type', label: 'Type', type: 'badge', required: false },
      { field: 'Scope', label: 'Scope', type: 'text', required: false },
      { field: 'Status', label: 'Status', type: 'status', required: true }
    ],
    apiSource: {
      type: 'OData',
      endpoint: 'Policy',
      idField: 'Id'
    }
  }
};

// ============================================================================
// LANE CONFIGURATION SCHEMA - Defines lanes for each focus node type
// ============================================================================

/**
 * Schema defining which lanes to show for each focus node type,
 * including the API calls needed to populate each lane.
 */
export const LaneConfigSchema = {
  [NodeTypes.IDENTITY]: {
    lanes: [
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'Systems',
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'systems' },
        position: { x: -380, y: -220 }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 380, y: -220 }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        apiSource: { type: 'GraphQL', query: 'getCalculatedAssignmentsDetailed', idParam: 'identityUId' },
        position: { x: -380, y: 80 }
      },
      {
        laneType: LaneTypes.CONTEXTS,
        title: 'Contexts',
        apiSource: { type: 'GraphQL', query: 'getIdentityContexts', idParam: 'identityUId' },
        position: { x: 380, y: 80 }
      },
      {
        laneType: LaneTypes.ROLES,
        title: 'Roles',
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'roles' },
        position: { x: 0, y: 300 }
      }
    ]
  },

  [NodeTypes.ROLE]: {
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Members',
        apiSource: { type: 'OData', endpoint: 'RoleMember', filter: 'RoleId eq {id}' },
        position: { x: -380, y: 0 }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        apiSource: { type: 'OData', endpoint: 'RoleEntitlement', filter: 'RoleId eq {id}' },
        position: { x: 380, y: 0 }
      },
      {
        laneType: LaneTypes.POLICIES,
        title: 'Policies',
        apiSource: { type: 'OData', endpoint: 'Policy', filter: 'applies to role' },
        position: { x: 0, y: 250 }
      }
    ]
  },

  [NodeTypes.ENTITLEMENT]: {
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Who Has This',
        description: 'Identities that have access to this entitlement',
        apiSource: { type: 'GraphQL', query: 'getIdentitiesHavingResource', idParam: 'resourceId' },
        position: { x: -380, y: 0 }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        description: 'Accounts through which this entitlement is accessed',
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 380, y: 0 }
      },
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'System',
        description: 'System where this entitlement resides',
        apiSource: { type: 'derived', from: 'focusNode', extract: 'system' },
        position: { x: 0, y: 250 }
      }
    ]
  },

  [NodeTypes.SYSTEM]: {
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Users',
        description: 'Identities with access to this system',
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'identities' },
        position: { x: -850, y: -500 }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        description: 'Accounts on this system',
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 850, y: -500 }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        description: 'Resources/entitlements on this system',
        apiSource: { type: 'GraphQL', query: 'getCalculatedAssignmentsDetailed', idParam: 'systemId' },
        position: { x: 0, y: 350 }
      }
    ]
  },

  [NodeTypes.ACCOUNT]: {
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Owner',
        apiSource: { type: 'derived', from: 'focusNode', extract: 'identity' },
        position: { x: -380, y: 0 }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        apiSource: { type: 'GraphQL', query: 'getAccountEntitlements', idParam: 'accountId' },
        position: { x: 380, y: 0 }
      },
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'System',
        apiSource: { type: 'derived', from: 'focusNode', extract: 'system' },
        position: { x: 0, y: 250 }
      }
    ]
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the schema for a focus node type
 */
export const getFocusNodeSchema = (nodeType) => {
  return FocusNodeSchema[nodeType] || FocusNodeSchema[NodeTypes.IDENTITY];
};

/**
 * Get lane configuration for a focus node type
 */
export const getLaneConfig = (nodeType) => {
  return LaneConfigSchema[nodeType] || LaneConfigSchema[NodeTypes.IDENTITY];
};

/**
 * Extract a field value from an object using the field path
 * Supports fallbacks with | and nested paths with .
 * Example: "OUREF.DisplayName|OUREF" tries OUREF.DisplayName first, then OUREF
 */
export const extractFieldValue = (obj, fieldPath) => {
  if (!obj || !fieldPath) return null;

  // Handle fallbacks (field1|field2|field3)
  const alternatives = fieldPath.split('|');

  for (const alt of alternatives) {
    // Handle concatenation (FIRSTNAME+LASTNAME)
    if (alt.includes('+')) {
      const parts = alt.split('+').map(f => extractSingleField(obj, f.trim())).filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
      continue;
    }

    const value = extractSingleField(obj, alt.trim());
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
};

/**
 * Extract a single field value, handling nested paths
 */
function extractSingleField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return null;

    // Handle both camelCase and PascalCase
    current = current[part] ?? current[part.toLowerCase()] ?? current[part.charAt(0).toLowerCase() + part.slice(1)];
  }

  // Handle object values (like { DisplayName: "value" })
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    return current.DisplayName || current.Name || current.Value || current.name || current.displayName || null;
  }

  return current;
}

// Legacy function for backwards compatibility
export const getLanesForNodeType = (nodeType) => {
  const config = LaneConfigSchema[nodeType];
  if (config) {
    return config.lanes.map(l => l.laneType);
  }

  // Fallback for undefined types
  switch (nodeType) {
    case NodeTypes.IDENTITY:
      return [LaneTypes.ROLES, LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.SYSTEMS, LaneTypes.CONTEXTS];
    case NodeTypes.ROLE:
      return [LaneTypes.IDENTITIES, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.POLICIES];
    case NodeTypes.ENTITLEMENT:
      return [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS];
    case NodeTypes.SYSTEM:
      return [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.IDENTITIES];
    case NodeTypes.ACCOUNT:
      return [LaneTypes.IDENTITIES, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.SYSTEMS];
    default:
      return [LaneTypes.IDENTITIES];
  }
};
