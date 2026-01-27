/**
 * Identity360 Type Definitions
 * Types for the IGA access graph exploration widget
 *
 * This module re-exports base enums from ./schemas/baseEnums.js and defines
 * complex schemas that depend on those enums. For cleaner imports in new code,
 * consider importing directly from './schemas'.
 */

// ============================================================================
// RE-EXPORT BASE ENUMS FROM SCHEMAS MODULE
// ============================================================================
export {
  NodeTypes,
  EdgeTypes,
  BaseReasonTypes,
  ReasonTypes,
  LaneTypes,
  ViewModes,
  ActionTypes,
  CompassOrientation,
  CrossLaneFilterType,
  LaneDisplayRules,
  LaneGridConstraints
} from './schemas/baseEnums';

// Import for local use in this file
import {
  NodeTypes,
  EdgeTypes,
  BaseReasonTypes,
  ReasonTypes,
  LaneTypes,
  ViewModes,
  ActionTypes,
  CompassOrientation,
  CrossLaneFilterType,
  LaneDisplayRules,
  LaneGridConstraints
} from './schemas/baseEnums';

// ============================================================================
// DEBUG CONFIGURATION
// Set these flags to true to enable verbose logging for specific modules
// ============================================================================
export const DebugConfig = {
  // API and data fetching
  API_CALLS: true,            // Log API request/response details
  API_ERRORS: true,           // Log API errors to console

  // Lane building and data processing
  LANE_BUILDING: false,       // Log lane construction details
  ENTITLEMENTS: false,        // Log entitlement processing (deduplication, exclusion)
  IDENTITIES: false,          // Log identity lane building
  ACCOUNTS: false,            // Log account lane building
  SYSTEMS: false,             // Log system lane building

  // Cross-lane filtering
  CROSS_LANE_FILTER: false,   // Log cross-lane filter operations
  CASCADED_FILTER: false,     // Log cascaded filter operations (Policy -> Accounts)
  ARRAY_FILTER: false,        // Log array contains filter operations

  // UI interactions
  ITEM_CLICK: false,          // Log item selection events
  PIVOT: false,               // Log pivot operations

  // Data transformations
  EXCLUSION_RULES: false,     // Log exclusion rule applications
  DATA_TRANSFORM: false,      // Log data transformation operations

  // All modules - master switch
  ALL: false                  // Enable all debug logging (overrides individual flags)
};

// Helper function to check if logging is enabled for a module
// Also checks user preference from localStorage
export const shouldLog = (module) => {
  // First check if Identity360 logging is enabled in user preferences
  try {
    const stored = localStorage.getItem('app_user_preferences');
    if (stored) {
      const prefs = JSON.parse(stored);
      // If user has disabled Identity360 logging, return false
      if (prefs.debugEnableAccessLensLogging === false) {
        return false;
      }
    }
  } catch (e) {
    // Ignore errors, fall through to default behavior
  }

  // Then check the module-specific debug config
  return DebugConfig.ALL || DebugConfig[module] || false;
};

// ============================================================================
// LANE SCHEMA - Defines display rules based on data type
// Note: LaneDisplayRules and CompassOrientation are imported from ./schemas/baseEnums.js
// ============================================================================

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
    },
    // Inspector configuration for Logical Applications
    inspectorConfig: {
      showAttributes: [
        { field: 'Name', label: 'Name', type: 'text' },
        { field: 'DisplayName', label: 'Display Name', type: 'text' },
        { field: 'Description', label: 'Description', type: 'text' },
        { field: 'resourceCount', label: 'Resources', type: 'number' },
        { field: 'underlyingSystems', label: 'Implemented By', type: 'array' },
        { field: 'systemType', label: 'System Type', type: 'text' },
        { field: 'owner', label: 'Owner', type: 'text' },
        { field: 'classification', label: 'Classification', type: 'text' }
      ],
      hideAttributes: ['Id', 'UId', 'id', 'underlyingSystemIds', 'isLogical']
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
    exclusionList: [
      {
        // Exclude unresolved identities - these are placeholder entries for accounts without linked identities
        fields: ['displayName', 'identity.displayName', 'DISPLAYNAME'],
        values: ['UNRESOLVED IDENTITY', 'Unresolved Identity'],
        matchType: 'equals'
      }
    ],
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
  [LaneTypes.ASSIGNMENT_POLICIES]: {
    dataType: NodeTypes.POLICY,
    displayRule: 'SINGLE_COLUMN',
    icon: '📜',
    color: '#d08770',  // Orange color to distinguish from other policies
    label: 'Assignment Policies',
    description: 'Policies that have assigned entitlements to this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.S,  // South
      priority: 2
    },
    // This lane is derived from calculatedAssignments reason data
    apiSource: {
      type: 'derived',
      from: 'calculatedAssignments',
      extract: 'assignmentPolicies',  // Extract policies from reason.reasonType === 'Policy'
      parseDescription: true  // Parse policy name from description field
    },
    // Cross-lane filtering: when policy selected, filter entitlements
    crossLaneFilters: {
      [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
        filterField: 'resourceIds',  // Array of resource IDs this policy assigns
        targetField: 'id'            // Match against entitlement ID
      }
    }
  },
  [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
    dataType: NodeTypes.ENTITLEMENT,
    displayRule: 'THREE_COLUMN',
    minColumns: 2,  // Minimum columns for entitlements (enforced in LaneCard)
    icon: '🔑',
    color: '#ebcb8b',
    label: 'Effective Entitlements',
    description: 'All effective entitlements for this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [
      {
        // Exclude default account resources (use contains for this one)
        fields: ['resource.name', 'resource.description'],
        values: ['default account resource'],
        matchType: 'contains'
      },
      {
        // Exclude account-type resources - these belong in the Accounts lane, not Entitlements
        // Use ENDS_WITH to catch resource types like "Active Directory corporate.com Account"
        fields: ['resource.resourceType.name'],
        values: ['account'],
        matchType: 'endsWith'
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
      compass: CompassOrientation.NW,  // North-West (shares with Effective Entitlements, but rarely shown)
      priority: 2  // Lower priority than Effective Entitlements
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Resource',
      filterField: 'Name',  // Field to use in OData $filter
      idField: 'Id',
      selectFields: 'Id,Name,DisplayName,Description,ResourceType,SystemRef,Status,RiskScore'
    }
  },
  [LaneTypes.VIOLATIONS]: {
    dataType: NodeTypes.VIOLATION,
    displayRule: 'SINGLE_COLUMN',
    icon: '⚠️',
    color: '#f59e0b',  // Warning yellow/amber color
    label: 'Violations',
    description: 'Policy violations for this identity',
    sortable: true,
    collapsible: true,
    exclusionList: [],
    defaultPosition: {
      compass: CompassOrientation.N,  // North (above center) - violations are important, show at top
      priority: 0  // Highest priority - violations always get the N position
    },
    apiSource: {
      type: 'derived',
      from: 'calculatedAssignments',
      extract: 'violations'
    },
    // Inspector configuration for violations
    inspectorConfig: {
      showAttributes: [
        { field: 'description', label: 'Description', type: 'text' },
        { field: 'status', label: 'Status', type: 'text' },
        { field: 'severity', label: 'Severity', type: 'text' },
        { field: 'resourceIds', label: 'Affected Resources', type: 'array' }
      ],
      hideAttributes: ['id', 'Id']
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
      rows: 5,
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
    rows: displayRules.rows,
    width: displayRules.width,
    minColumns: schema.minColumns || 1,  // Lane-specific minimum columns (default: 1)
    maxVisibleItems: schema.maxVisibleItems || displayRules.maxVisibleItems
  };
};

// Legacy export for backwards compatibility
export const LaneDisplayConfig = Object.keys(LaneSchema).reduce((acc, laneType) => {
  acc[laneType] = getLaneDisplayConfig(laneType);
  return acc;
}, {});

// Note: ViewModes is imported from ./schemas/baseEnums.js

// Get icon for node type - uses FocusNodeSchema
export const getNodeIcon = (type) => {
  return FocusNodeSchema[type]?.icon || '📦';
};

// Get color for node type - uses FocusNodeSchema
export const getNodeColor = (type) => {
  return FocusNodeSchema[type]?.color || '#4c566a';
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
 *
 * Each schema also includes:
 * - fieldMappings: Normalizes API response fields to standard names
 *   Handles variations between OData (UPPERCASE), GraphQL (camelCase), etc.
 */
export const FocusNodeSchema = {
  [NodeTypes.IDENTITY]: {
    title: 'Identity',
    icon: '👤',
    color: '#88c0d0',
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
    // Field mappings to normalize API responses to standard field names
    fieldMappings: {
      id: ['UId', 'Id', 'id', 'uid'],
      identityId: ['IDENTITYID', 'identityId', 'IdentityId'],
      displayName: ['DISPLAYNAME', 'DisplayName', 'displayName', 'Name', 'name'],
      firstName: ['FIRSTNAME', 'FirstName', 'firstName'],
      lastName: ['LASTNAME', 'LastName', 'lastName'],
      email: ['EMAIL', 'Email', 'email'],
      status: ['IDENTITYSTATUS', 'Status', 'status'],
      riskLevel: ['RISKLEVEL', 'RiskLevel', 'riskLevel']
    },
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
    color: '#a3be8c',
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
    color: '#bf616a',
    primaryField: 'AccountName|DisplayName|Name',
    attributes: [
      { field: 'System.Name|SystemName', label: 'System', type: 'badge', required: true },
      { field: 'AccountType.Name|AccountType', label: 'Type', type: 'badge', required: false },
      { field: 'Identity.DisplayName', label: 'Owner', type: 'text', required: false },
      { field: 'LastLogin', label: 'Last Login', type: 'date', required: false },
      { field: 'Status', label: 'Status', type: 'status', required: true }
    ],
    fieldMappings: {
      id: ['id', 'Id', 'ID'],
      accountName: ['accountName', 'AccountName', 'ACCOUNTNAME', 'name', 'Name'],
      displayName: ['accountName', 'AccountName', 'displayName', 'DisplayName'],
      system: ['system.name', 'System.Name', 'systemName', 'SystemName'],
      systemId: ['system.id', 'System.Id', 'systemId', 'SystemId'],
      accountType: ['accountType.name', 'AccountType.Name', 'accountType', 'AccountType'],
      identityId: ['identity.id', 'identityId', 'IdentityId']
    },
    apiSource: {
      type: 'GraphQL',
      query: 'getAccountById',
      idField: 'id'
    }
  },

  [NodeTypes.ENTITLEMENT]: {
    title: 'Entitlement',
    icon: '🔑',
    color: '#ebcb8b',
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
    fieldMappings: {
      id: ['id', 'Id', 'ID', 'Uid', 'UId'],
      name: ['name', 'Name', 'NAME', 'displayName', 'DisplayName'],
      displayName: ['name', 'Name', 'displayName', 'DisplayName'],
      description: ['description', 'Description', 'DESCRIPTION'],
      system: ['system.name', 'System.Name', 'systemName', 'SystemName'],
      systemId: ['system.id', 'System.Id', 'systemId', 'SystemId'],
      resourceType: ['resourceType.name', 'ResourceType.Name', 'resourceType', 'ResourceType', 'type', 'Type'],
      resourceTypeId: ['resourceType.id', 'ResourceType.Id', 'resourceTypeId', 'ResourceTypeId'],
      complianceStatus: ['complianceStatus', 'ComplianceStatus', 'compliance'],
      owner: ['OWNERREF.DisplayNameValue', 'OWNERREF.DisplayName', 'owner', 'Owner']
    },
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
    color: '#d08770',
    primaryField: 'DISPLAYNAME|DisplayName|Name|name',
    attributes: [
      { field: 'DESCRIPTION|Description', label: 'Description', type: 'text', required: false },
      { field: 'Vendor', label: 'Vendor', type: 'text', required: false },
      { field: 'Category|SYSTEMCATEGORY', label: 'Category', type: 'badge', required: false },
      { field: 'AccountCount', label: 'Accounts', type: 'text', required: false },
      { field: 'Status|STATUS', label: 'Status', type: 'status', required: true }
    ],
    fieldMappings: {
      id: ['UId', 'Uid', 'id', 'Id', 'ID'],
      name: ['DISPLAYNAME', 'DisplayName', 'Name', 'name', 'NAME'],
      displayName: ['DISPLAYNAME', 'DisplayName', 'Name', 'name'],
      description: ['DESCRIPTION', 'Description', 'description'],
      status: ['STATUS', 'Status', 'status'],
      category: ['SYSTEMCATEGORY', 'systemCategory', 'Category', 'category'],
      owner: ['OWNERREF.DisplayNameValue', 'OWNERREF.DisplayName', 'owner', 'Owner']
    },
    apiSource: {
      type: 'OData',
      endpoint: 'System',
      idField: 'UId',
      selectFields: 'UId,Id,Name,DISPLAYNAME,DisplayName,DESCRIPTION,Description,Vendor,Category,Status,SYSTEMTYPE'
    }
  },

  [NodeTypes.LOGICAL_APPLICATION]: {
    title: 'Logical Application',
    icon: '☁️',
    color: '#8fbcbb',
    primaryField: 'DISPLAYNAME|DisplayName|Name|name',
    attributes: [
      { field: 'DESCRIPTION|Description', label: 'Description', type: 'text', required: false },
      { field: 'resourceCount', label: 'Entitlements', type: 'text', required: false },
      { field: 'SYSTEMTYPE.DisplayName|systemType', label: 'Type', type: 'badge', required: false },
      { field: 'underlyingSystems', label: 'Implemented By', type: 'array', required: false },
      { field: 'Status|STATUS', label: 'Status', type: 'status', required: false }
    ],
    fieldMappings: {
      id: ['UId', 'Uid', 'id', 'Id', 'ID'],
      name: ['DISPLAYNAME', 'DisplayName', 'Name', 'name', 'NAME'],
      displayName: ['DISPLAYNAME', 'DisplayName', 'Name', 'name'],
      description: ['DESCRIPTION', 'Description', 'description'],
      status: ['STATUS', 'Status', 'status'],
      resourceCount: ['resourceCount'],
      underlyingSystems: ['underlyingSystems', 'underlyingSystemIds']
    },
    apiSource: {
      type: 'OData',
      endpoint: 'System',
      idField: 'UId',
      selectFields: 'UId,Id,Name,DISPLAYNAME,DisplayName,DESCRIPTION,Description,SYSTEMTYPE,Status'
    }
  },

  [NodeTypes.CONTEXT]: {
    title: 'Context',
    icon: '🏷️',
    color: '#5e81ac',
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
    color: '#b48ead',
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
  },

  /**
   * Assignment Policy Schema
   *
   * Omada Assignment Policies automatically assign entitlements and accounts to identities
   * based on their contexts (organizational membership, job function, etc.).
   *
   * Key relationships:
   * - AP_CONTEXTS: Contexts that trigger this policy (identities in these contexts get assigned)
   * - AP_RESOURCES: Entitlements/Resources assigned by this policy
   * - AP_ACCOUNTRESOURCES: Account resources assigned by this policy
   *
   * This enables:
   * - Viewing which entitlements a policy grants
   * - Understanding which contexts trigger automatic assignment
   * - Calculating policy alignment (% of identity access from policies)
   */
  [NodeTypes.ASSIGNMENT_POLICY]: {
    title: 'Assignment Policy',
    icon: '📜',
    color: '#d08770',
    primaryField: 'DISPLAYNAME|DisplayName|Name',
    attributes: [
      { field: 'DESCRIPTION|Description', label: 'Description', type: 'text', required: false },
      { field: 'ISACTIVE|IsActive', label: 'Active', type: 'boolean', required: false },
      { field: 'VALIDFROM|ValidFrom', label: 'Valid From', type: 'date', required: false },
      { field: 'VALIDTO|ValidTo', label: 'Valid To', type: 'date', required: false },
      { field: 'AP_CONTEXTS', label: 'Contexts', type: 'array', arrayDisplayField: 'DisplayName', required: false },
      { field: 'AP_RESOURCES', label: 'Resources', type: 'array', arrayDisplayField: 'DisplayName', required: false },
      { field: 'AP_ACCOUNTRESOURCES', label: 'Account Resources', type: 'array', arrayDisplayField: 'DisplayName', required: false },
      { field: 'OWNERREF|OwnerRef', label: 'Owner', type: 'reference', referenceDisplayField: 'DisplayName', required: false }
    ],
    // Relationships that can be extracted from Assignment Policy data
    relationships: {
      contexts: {
        field: 'AP_CONTEXTS',
        targetType: NodeTypes.CONTEXT,
        description: 'Contexts that trigger this policy - identities in these contexts will be assigned the resources'
      },
      resources: {
        field: 'AP_RESOURCES',
        targetType: NodeTypes.ENTITLEMENT,
        description: 'Entitlement resources automatically assigned by this policy'
      },
      accountResources: {
        field: 'AP_ACCOUNTRESOURCES',
        targetType: NodeTypes.ACCOUNT,
        description: 'Account resources automatically assigned by this policy'
      }
    },
    apiSource: {
      type: 'OData',
      endpoint: 'Assignmentpolicy',
      idField: 'UId',
      intIdField: 'Id'
    }
  },

  [NodeTypes.VIOLATION]: {
    title: 'Violation',
    icon: '⚠️',
    color: '#f59e0b',  // Warning yellow/amber color
    primaryField: 'description|Description|name|Name',
    attributes: [
      { field: 'description|Description', label: 'Description', type: 'text', required: true },
      { field: 'status|Status', label: 'Status', type: 'badge', required: false },
      { field: 'severity|Severity', label: 'Severity', type: 'badge', required: false },
      { field: 'policyName|PolicyName', label: 'Policy', type: 'text', required: false },
      { field: 'resourceIds', label: 'Affected Resources', type: 'array', required: false }
    ],
    fieldMappings: {
      id: ['id', 'Id', 'ID'],
      description: ['description', 'Description', 'DESCRIPTION', 'name', 'Name'],
      displayName: ['description', 'Description', 'name', 'Name'],
      status: ['status', 'Status', 'STATUS'],
      severity: ['severity', 'Severity', 'SEVERITY']
    },
    apiSource: {
      type: 'derived',  // Violations are derived from calculatedAssignments
      from: 'calculatedAssignments',
      extract: 'violations'
    }
  }
};

// ============================================================================
// LANE CONFIGURATION SCHEMA - Defines lanes for each focus node type
// ============================================================================
// Note: CrossLaneFilterType is imported from ./schemas/baseEnums.js

/**
 * Schema defining which lanes to show for each focus node type,
 * including the API calls needed to populate each lane.
 *
 * Lane properties:
 * - laneType: The LaneTypes enum value
 * - title: Display title for the lane
 * - description: Optional description
 * - apiSource: How to fetch data for this lane
 * - position: Default x,y position relative to center
 * - required: If true, lane is always visible even when empty (after filtering)
 * - crossLaneFilters: Defines how this lane interacts with other lanes when selected
 *   - filtersLanes: Array of lane types this lane can filter (downstream targets)
 *   - filteredByLanes: Array of lane types that can filter this lane (upstream sources)
 *   - filterMappings: Object defining field mappings for each relationship
 *
 * HIERARCHICAL SELECTION BEHAVIOR:
 * When clicking an item in a lane, selections for lanes in `filteredByLanes` are PRESERVED.
 * This enables "drill-down" UX where users can:
 *   1. Click a Policy to filter Entitlements (Policy is upstream filter source)
 *   2. Click an Entitlement to inspect it (Policy filter persists, entitlement shows in inspector)
 * The upstream filter context is maintained while drilling into filtered results.
 * Only selections for lanes NOT in `filteredByLanes` are cleared on click.
 */
export const LaneConfigSchema = {
  [NodeTypes.IDENTITY]: {
    // Identity is the focus node, so no Identities lane is needed
    excludedLanes: [LaneTypes.IDENTITIES],
    lanes: [
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'Systems',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'systems' },
        position: { x: -380, y: -220 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],
          filterMappings: {
            // When System is selected, filter Accounts by system
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['id', 'displayName'],
              targetFields: ['metadata.systemId', 'metadata.system']
            },
            // When System is selected, filter Entitlements by system
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['id', 'displayName'],
              targetFields: ['metadata.systemId', 'metadata.system']
            },
            // When System is selected, filter Logical Applications to those implemented by this system
            // A logical app is shown if the selected system is one of its underlying (implementing) systems
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.underlyingSystemIds'
            },
            // When System is selected, filter Assignment Policies to show only those that assign entitlements on this system
            // This is a cascaded filter: System -> Entitlements (by systemId) -> Policies (by resourceIds)
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',                              // System's ID
              intermediateTargetField: 'metadata.systemId',   // Match against entitlement's systemId
              intermediateExtractField: 'id',                 // Extract entitlement IDs from filtered entitlements
              targetField: 'metadata.resourceIds'                      // Match against policy's resourceIds array
            }
          }
        }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 750, y: -380 },  // North-East - matches COMPASS_POSITIONS[NE]
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.SYSTEMS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.SYSTEMS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],
          filterMappings: {
            // When Account is selected, filter Entitlements by account
            // Uses ARRAY_CONTAINS because deduplicated entitlements store arrays of accountIds
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.accountIds'
            },
            // When Account is selected, filter Systems to show account's system
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            },
            // When Account is selected, filter Logical Applications to show only those with entitlements accessible via this account
            // This is a cascaded filter: Account -> Entitlements (by accountId) -> extract systemId/system -> match Logical App id/displayName
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',                          // Account's ID
              intermediateTargetField: 'metadata.accountIds',  // Match against entitlement's accountIds array
              intermediateExtractFields: ['metadata.systemId', 'metadata.system'],  // Get systemId OR system name from each filtered entitlement
              targetFields: ['id', 'displayName']         // Match against logical app's ID or displayName
            },
            // When Account is selected, filter Assignment Policies to show only those that assign entitlements accessible via this account
            // This is a cascaded filter: Account -> Entitlements (by accountIds) -> Policies (by resourceIds)
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',                          // Account's ID
              intermediateTargetField: 'metadata.accountIds',  // Match against entitlement's accountIds array
              intermediateExtractField: 'id',             // Extract entitlement IDs from filtered entitlements
              targetField: 'metadata.resourceIds'                  // Match against policy's resourceIds array
            }
          }
        }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        required: false,
        apiSource: { type: 'GraphQL', query: 'getCalculatedAssignmentsDetailed', idParam: 'identityUId' },
        position: { x: -380, y: 80 },
        crossLaneFilters: {
          // When an entitlement is selected, filter related lanes to show only relevant items
          filtersLanes: [LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.SYSTEMS, LaneTypes.ACCOUNTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],
          filterMappings: {
            // When Entitlement is selected, filter Logical Applications to show only the one this entitlement belongs to
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            },
            // When Entitlement is selected, filter Systems to show only the one this entitlement belongs to
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            },
            // When Entitlement is selected, filter Accounts to show only those with this entitlement
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.accountIds',
              targetField: 'id'
            },
            // When Entitlement is selected, filter Assignment Policies to show only those that assign this entitlement
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',           // Entitlement's ID
              targetField: 'metadata.resourceIds'   // Policy's resourceIds array should contain the entitlement ID
            }
          }
        }
      },
      {
        laneType: LaneTypes.CONTEXTS,
        title: 'Contexts',
        required: false,
        apiSource: { type: 'GraphQL', query: 'getIdentityContexts', idParam: 'identityUId' },
        position: { x: 380, y: 80 },
        crossLaneFilters: {
          filtersLanes: [],  // Contexts don't filter other lanes directly
          filteredByLanes: [LaneTypes.ASSIGNMENT_POLICIES],  // Contexts can be filtered by Assignment Policies (via AP_CONTEXTS)
          filterMappings: {}
        }
      },
      {
        laneType: LaneTypes.LOGICAL_APPLICATIONS,
        title: 'Logical Applications',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'logicalApps' },
        position: { x: 600, y: 80 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.SYSTEMS, LaneTypes.ACCOUNTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],
          filterMappings: {
            // When Logical App is selected, filter Entitlements to those on this logical system
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['id', 'displayName'],
              targetFields: ['metadata.systemId', 'metadata.system']
            },
            // When Logical App is selected, filter Systems to show only the underlying physical systems
            // The Logical App stores its implementing systems in metadata.underlyingSystemIds
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.underlyingSystemIds',
              targetField: 'id'
            },
            // When Logical App is selected, filter Accounts to those on the underlying physical systems
            // Uses the same underlyingSystemIds to match accounts' system
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.underlyingSystemIds',
              targetField: 'metadata.systemId'
            },
            // When Logical App is selected, filter Assignment Policies to show only those that assign entitlements on this logical app
            // This is a cascaded filter: Logical App -> Entitlements (by systemId) -> Policies (by resourceIds)
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',                              // Logical App's ID
              intermediateTargetField: 'metadata.systemId',   // Match against entitlement's systemId
              intermediateExtractField: 'id',                 // Extract entitlement IDs from filtered entitlements
              targetField: 'metadata.resourceIds'                      // Match against policy's resourceIds array
            }
          }
        }
      },
      {
        laneType: LaneTypes.ROLES,
        title: 'Roles',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'roles' },
        position: { x: 0, y: 300 },
        crossLaneFilters: null  // Roles don't participate in cross-lane filtering currently
      },
      {
        laneType: LaneTypes.ASSIGNMENT_POLICIES,
        title: 'Assignment Policies',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'assignmentPolicies' },
        position: { x: -600, y: 80 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.CONTEXTS],
          filteredByLanes: [LaneTypes.VIOLATIONS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS],  // Policies are filtered when a violation, logical app, entitlement, account, or system is selected
          filterMappings: {
            // When Policy is selected, filter Entitlements to show only those assigned by this policy
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',  // Array of resource IDs this policy assigns
              targetField: 'id'            // Match against entitlement's resource ID
            },
            // When Policy is selected, filter Accounts to show only those relevant to the policy's entitlements
            // This is a cascaded filter: Policy -> Entitlements (by resourceIds) -> Accounts (by accountIds array)
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              // First, filter the intermediate lane (Entitlements)
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',           // Policy's array of resource IDs
              intermediateTargetField: 'id',        // Match against entitlement's ID
              // Then, extract values from filtered entitlements to filter Accounts
              // Uses accountIds (array) because deduplicated entitlements aggregate all accounts
              intermediateExtractField: 'metadata.accountIds',  // Get accountIds array from each filtered entitlement
              targetField: 'id'                     // Match against account's ID
            },
            // When Policy is selected, filter Systems to show only systems with entitlements assigned by this policy
            // This is a cascaded filter: Policy -> Entitlements (by resourceIds) -> Systems (by systemId/system)
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',           // Policy's array of resource IDs
              intermediateTargetField: 'id',        // Match against entitlement's ID
              intermediateExtractFields: ['metadata.systemId', 'metadata.system'],  // Get systemId OR system name
              targetFields: ['id', 'displayName']   // Match against system's ID or displayName
            },
            // When Policy is selected, filter Logical Applications to show only those with entitlements assigned by this policy
            // This is a cascaded filter: Policy -> Entitlements (by resourceIds) -> Logical Apps (by systemId/system)
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',           // Policy's array of resource IDs
              intermediateTargetField: 'id',        // Match against entitlement's ID
              intermediateExtractFields: ['metadata.systemId', 'metadata.system'],  // Get systemId OR system name
              targetFields: ['id', 'displayName']   // Match against logical app's ID or displayName
            },
            // When Policy is selected, filter Contexts to show only those that trigger this policy
            // Uses AP_CONTEXTS array from OData enrichment - matches context UId
            [LaneTypes.CONTEXTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.contextUIds',  // Array of context UIds from AP_CONTEXTS
              targetField: 'metadata.uId'           // Match against context's UId
            }
          }
        }
      },
      {
        laneType: LaneTypes.VIOLATIONS,
        title: 'Violations',
        required: false,  // Only shows when violations exist
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'violations' },
        position: { x: 0, y: -380 },  // Position above center (North) - matches COMPASS_POSITIONS
        crossLaneFilters: {
          // Violations filter other lanes to show only related items
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [],  // Violations are not filtered by other lanes
          filterMappings: {
            // When Violation is selected, filter Entitlements to show only those involved in the violation
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',  // Array of resource IDs involved in this violation
              targetField: 'id'            // Match against entitlement's resource ID
            },
            // When Violation is selected, filter Accounts via cascaded filter through Entitlements
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractField: 'metadata.accountIds',
              targetField: 'id'
            },
            // When Violation is selected, filter Systems via cascaded filter through Entitlements
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            },
            // When Violation is selected, filter Logical Applications via cascaded filter through Entitlements
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            },
            // When Violation is selected, filter Assignment Policies to show only those that assigned the violating entitlements
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',
              targetField: 'metadata.resourceIds'  // Policy's resourceIds array should contain the violation's resourceIds
            }
          }
        }
      }
    ]
  },

  [NodeTypes.ROLE]: {
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Members',
        required: true,
        apiSource: { type: 'OData', endpoint: 'RoleMember', filter: 'RoleId eq {id}' },
        position: { x: -380, y: 0 },
        crossLaneFilters: null
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        required: true,
        apiSource: { type: 'OData', endpoint: 'RoleEntitlement', filter: 'RoleId eq {id}' },
        position: { x: 380, y: 0 },
        crossLaneFilters: null
      },
      {
        laneType: LaneTypes.POLICIES,
        title: 'Policies',
        required: false,
        apiSource: { type: 'OData', endpoint: 'Policy', filter: 'applies to role' },
        position: { x: 0, y: 250 },
        crossLaneFilters: null
      }
    ]
  },

  [NodeTypes.ENTITLEMENT]: {
    // Entitlement is the focus node, so no Entitlements lane is needed
    excludedLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS],
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Who Has This',
        description: 'Identities that have access to this entitlement',
        required: true,  // Always show identities lane for entitlement view
        apiSource: { type: 'GraphQL', query: 'getIdentitiesHavingResource', idParam: 'resourceId' },
        position: { x: -380, y: 0 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.ACCOUNTS],
          filteredByLanes: [LaneTypes.ACCOUNTS],
          filterMappings: {
            // When Identity is selected, filter Accounts to show only that identity's accounts
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.identityIds'  // Account stores array of identity IDs
            }
          }
        }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        description: 'Accounts through which this entitlement is accessed',
        required: true,  // Always show accounts lane for entitlement view
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 380, y: 0 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.IDENTITIES],
          filteredByLanes: [LaneTypes.IDENTITIES],
          filterMappings: {
            // When Account is selected, filter Identities to show the account owner
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',  // Get identity IDs from account
              targetField: 'id'  // Match against identity ID
            }
          }
        }
      },
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'System',
        description: 'System where this entitlement resides',
        required: false,
        apiSource: { type: 'derived', from: 'focusNode', extract: 'system' },
        position: { x: 0, y: 250 },
        crossLaneFilters: null  // System is just informational in entitlement view
      }
    ]
  },

  [NodeTypes.SYSTEM]: {
    // System is the focus node, so no Systems lane is needed
    excludedLanes: [LaneTypes.SYSTEMS],
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Users',
        description: 'Identities with access to this system',
        required: true,  // Always show identities lane for system view
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'identities' },
        position: { x: -850, y: -500 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],  // Can be filtered by Accounts, Entitlements, Policies, or Violations
          filterMappings: {
            // When Identity is selected, filter Accounts to show only that identity's accounts
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.identityIds'
            },
            // When Identity is selected, filter Entitlements to show only that identity's entitlements
            // Uses ARRAY_CONTAINS because deduplicated entitlements store arrays of identityIds
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.identityIds'
            },
            // When Identity is selected, filter Assignment Policies to show only those that assigned entitlements to this identity
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',
              intermediateTargetField: 'metadata.identityIds',
              intermediateExtractField: 'id',
              targetField: 'metadata.resourceIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        description: 'Accounts on this system',
        required: true,  // Always show accounts lane for system view
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 850, y: -500 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.IDENTITIES, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.IDENTITIES, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],  // Can be filtered by Identities, Entitlements, Policies, or Violations
          filterMappings: {
            // When Account is selected, filter Identities to show the account owner(s)
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',
              targetField: 'id'
            },
            // When Account is selected, filter Entitlements to show only that account's entitlements
            // Uses ARRAY_CONTAINS because deduplicated entitlements store arrays of accountIds
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.accountIds'
            },
            // When Account is selected, filter Assignment Policies to show only those that assigned entitlements to this account
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',
              intermediateTargetField: 'metadata.accountIds',
              intermediateExtractField: 'id',
              targetField: 'metadata.resourceIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        description: 'Resources/entitlements on this system',
        required: true,  // Always show entitlements lane for system view
        apiSource: { type: 'GraphQL', query: 'getCalculatedAssignmentsDetailed', idParam: 'systemId' },
        position: { x: 0, y: 350 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.ASSIGNMENT_POLICIES],  // Entitlements can filter Identities, Accounts, and Policies
          filteredByLanes: [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS],  // Can be filtered by Identities, Accounts, Policies, or Violations
          filterMappings: {
            // When Entitlement is selected, filter Identities to show only those with this entitlement
            // Uses ARRAY_CONTAINS because deduplicated entitlements store arrays of identityIds
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',  // Array of identity IDs that have this entitlement
              targetField: 'id'                      // Match against identity's ID
            },
            // When Entitlement is selected, filter Accounts to show only those with this entitlement
            // Uses ARRAY_CONTAINS because deduplicated entitlements store arrays of accountIds
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.accountIds',   // Array of account IDs that have this entitlement
              targetField: 'id'                      // Match against account's ID
            },
            // When Entitlement is selected, filter Assignment Policies to show only those that assign this entitlement
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',           // Entitlement's ID
              targetField: 'metadata.resourceIds'   // Policy's resourceIds array should contain the entitlement ID
            }
          }
        }
      },
      {
        laneType: LaneTypes.LOGICAL_APPLICATIONS,
        title: 'Logical Applications',
        description: 'Logical applications implemented by this system',
        required: false,  // Only show if there are logical apps implemented by this system
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'logicalAppsForSystem' },
        position: { x: 850, y: 350 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.ASSIGNMENT_POLICIES],  // Can be filtered by Assignment Policies
          filterMappings: {
            // When Logical App is selected, filter Entitlements to those on the logical system
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['id', 'displayName'],
              targetFields: ['metadata.systemId', 'metadata.system']
            },
            // When Logical App is selected, filter Assignment Policies to show only those that assign entitlements on this logical app
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',
              intermediateTargetField: 'metadata.systemId',
              intermediateExtractField: 'id',
              targetField: 'metadata.resourceIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.ASSIGNMENT_POLICIES,
        title: 'Assignment Policies',
        description: 'Policies that assign entitlements on this system',
        required: false,  // Only show if there are policies assigning entitlements on this system
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'policies' },
        position: { x: -850, y: 350 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS],
          filteredByLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.VIOLATIONS],  // Can be filtered by Entitlements, Identities, Accounts, Logical Apps, or Violations
          filterMappings: {
            // When Policy is selected, filter Entitlements to show only those assigned by this policy
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',
              targetField: 'id'
            },
            // When Policy is selected, filter Identities to show only those who received entitlements via this policy
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractField: 'metadata.identityIds',
              targetField: 'id'
            },
            // When Policy is selected, filter Accounts to show only those with entitlements assigned by this policy
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractField: 'metadata.accountIds',
              targetField: 'id'
            }
          }
        }
      },
      {
        laneType: LaneTypes.VIOLATIONS,
        title: 'Violations',
        description: 'Access violations on this system',
        required: false,  // Only shows when violations exist
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'violations' },
        position: { x: 0, y: -380 },  // Position above center (North)
        crossLaneFilters: {
          // Violations filter other lanes to show only related items
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [],  // Violations are not filtered by other lanes
          filterMappings: {
            // When Violation is selected, filter Entitlements to show only those involved in the violation
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',  // Array of resource IDs involved in this violation
              targetField: 'id'                      // Match against entitlement's resource ID
            },
            // When Violation is selected, filter Identities to show only those with this violation
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',  // Array of identity IDs involved in this violation
              targetField: 'id'                      // Match against identity's ID
            },
            // When Violation is selected, filter Accounts via cascaded filter through Entitlements
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractField: 'metadata.accountIds',
              targetField: 'id'
            },
            // When Violation is selected, filter Assignment Policies via cascaded filter through Entitlements
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',  // Array of resource IDs involved in this violation
              targetField: 'metadata.resourceIds'   // Match against policy's resourceIds
            }
          }
        }
      }
    ]
  },

  /**
   * Logical Application as Focus Node
   *
   * When a Logical Application (system with resources but no direct accounts) is the central focus, show:
   * - IDENTITIES: Users who have access to this logical application (via accounts on implementing systems)
   * - SYSTEMS: Physical systems that implement this logical application
   * - ENTITLEMENTS: Resources/entitlements on this logical application
   *
   * This view helps answer:
   * - "Who has access to this application?"
   * - "Which physical systems provide access to this application?"
   * - "What entitlements exist on this application?"
   */
  [NodeTypes.LOGICAL_APPLICATION]: {
    excludedLanes: [LaneTypes.LOGICAL_APPLICATIONS],
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Users',
        description: 'Identities with access to this logical application',
        required: true,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'identities' },
        position: { x: -520, y: -200 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS],
          filteredByLanes: [LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS],
          filterMappings: {
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.identityIds'
            },
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.identityIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'Implementing Systems',
        description: 'Physical systems that provide access to this logical application',
        required: true,
        apiSource: { type: 'derived', from: 'focusNode', extract: 'underlyingSystems' },
        position: { x: 520, y: -200 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.ACCOUNTS],
          filteredByLanes: [],
          filterMappings: {
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.DIRECT_MATCH,
              sourceField: 'id',
              targetField: 'metadata.systemId'
            }
          }
        }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Accounts',
        description: 'Accounts that provide access to this logical application',
        required: true,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'accounts' },
        position: { x: 520, y: 200 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.IDENTITIES, LaneTypes.EFFECTIVE_ENTITLEMENTS],
          filteredByLanes: [LaneTypes.IDENTITIES, LaneTypes.SYSTEMS],
          filterMappings: {
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',
              targetField: 'id'
            },
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.accountIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        description: 'Resources/entitlements on this logical application',
        required: true,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'entitlements' },
        position: { x: -520, y: 200 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS],
          filteredByLanes: [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS],
          filterMappings: {
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',
              targetField: 'id'
            },
            [LaneTypes.ACCOUNTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.accountIds',
              targetField: 'id'
            }
          }
        }
      }
    ]
  },

  /**
   * Account as Focus Node
   *
   * When an Account is the central focus, show:
   * - IDENTITIES: The identity that owns this account
   * - SYSTEMS: The system this account belongs to
   * - EFFECTIVE_ENTITLEMENTS: Entitlements/resources this account has access to
   * - ASSIGNMENT_POLICIES: Policies that assigned entitlements to this account
   * - LOGICAL_APPLICATIONS: Logical applications accessible via this account's entitlements
   *
   * EXCLUDED LANES (not shown when Account is focus node):
   * - ACCOUNTS: The Account itself is the focus node, so no Accounts lane is needed
   *
   * API Filter: Uses calculatedAssignments with:
   *   - multipleIdentityIds: identity UUID (owner of the account)
   *   - accountName: {filterValue: "ACCOUNT_NAME", operator: EQUALS}
   *
   * This view helps answer:
   * - "Who owns this account?"
   * - "What system is this account on?"
   * - "What entitlements does this account have?"
   * - "How did this account get its entitlements?" (via policies)
   * - "What business applications can this account access?"
   */
  [NodeTypes.ACCOUNT]: {
    // Lanes that should NOT be shown when Account is the focus node
    excludedLanes: [LaneTypes.ACCOUNTS],
    lanes: [
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Owner',
        description: 'The identity that owns this account',
        required: true,
        apiSource: { type: 'derived', from: 'focusNode', extract: 'identity' },
        position: { x: -850, y: -300 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES],
          filterMappings: {
            // When Identity is selected, filter Entitlements to show only those for this identity
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.identityIds'
            },
            // When Identity is selected, filter Assignment Policies via entitlements
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',
              intermediateTargetField: 'metadata.identityIds',
              intermediateExtractField: 'id',
              targetField: 'metadata.resourceIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.SYSTEMS,
        title: 'System',
        description: 'The system this account belongs to',
        required: true,
        apiSource: { type: 'derived', from: 'focusNode', extract: 'system' },
        position: { x: 850, y: -300 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS],
          filteredByLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS],
          filterMappings: {
            // When System is selected, filter Entitlements by system
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['id', 'displayName'],
              targetFields: ['metadata.systemId', 'metadata.system']
            },
            // When System is selected, filter Logical Applications to those implemented by this system
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.underlyingSystemIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Entitlements',
        description: 'Entitlements/resources this account has access to',
        required: true,
        apiSource: { type: 'GraphQL', query: 'getAccountEntitlements', idParam: 'accountId' },
        position: { x: 0, y: 350 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.IDENTITIES, LaneTypes.SYSTEMS],
          filteredByLanes: [LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.IDENTITIES, LaneTypes.SYSTEMS],
          filterMappings: {
            // When Entitlement is selected, filter Assignment Policies to show only those that assign this entitlement
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'id',
              targetField: 'metadata.resourceIds'
            },
            // When Entitlement is selected, filter Logical Applications to show the one this entitlement belongs to
            [LaneTypes.LOGICAL_APPLICATIONS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            },
            // When Entitlement is selected, filter Identities (should match the account owner)
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.identityIds',
              targetField: 'id'
            },
            // When Entitlement is selected, filter Systems to show the system this entitlement is on
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['metadata.systemId', 'metadata.system'],
              targetFields: ['id', 'displayName']
            }
          }
        }
      },
      {
        laneType: LaneTypes.ASSIGNMENT_POLICIES,
        title: 'Assignment Policies',
        description: 'Policies that assigned entitlements to this account',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'policies' },
        position: { x: -850, y: 350 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.IDENTITIES],
          filteredByLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.IDENTITIES, LaneTypes.LOGICAL_APPLICATIONS],
          filterMappings: {
            // When Policy is selected, filter Entitlements to show only those assigned by this policy
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.resourceIds',
              targetField: 'id'
            },
            // When Policy is selected, filter Identities via entitlements
            [LaneTypes.IDENTITIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'metadata.resourceIds',
              intermediateTargetField: 'id',
              intermediateExtractField: 'metadata.identityIds',
              targetField: 'id'
            }
          }
        }
      },
      {
        laneType: LaneTypes.LOGICAL_APPLICATIONS,
        title: 'Logical Applications',
        description: 'Business applications accessible via this account',
        required: false,
        apiSource: { type: 'derived', from: 'calculatedAssignments', extract: 'logicalApps' },
        position: { x: 850, y: 350 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.SYSTEMS, LaneTypes.ASSIGNMENT_POLICIES],
          filteredByLanes: [LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.SYSTEMS, LaneTypes.ASSIGNMENT_POLICIES],
          filterMappings: {
            // When Logical App is selected, filter Entitlements to those on this logical system
            [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
              type: CrossLaneFilterType.MULTI_FIELD_MATCH,
              sourceFields: ['id', 'displayName'],
              targetFields: ['metadata.systemId', 'metadata.system']
            },
            // When Logical App is selected, filter Systems to show underlying physical systems
            [LaneTypes.SYSTEMS]: {
              type: CrossLaneFilterType.ARRAY_CONTAINS,
              sourceField: 'metadata.underlyingSystemIds',
              targetField: 'id'
            },
            // When Logical App is selected, filter Assignment Policies via entitlements
            [LaneTypes.ASSIGNMENT_POLICIES]: {
              type: CrossLaneFilterType.CASCADED_THROUGH,
              intermediateLane: LaneTypes.EFFECTIVE_ENTITLEMENTS,
              sourceField: 'id',
              intermediateTargetField: 'metadata.systemId',
              intermediateExtractField: 'id',
              targetField: 'metadata.resourceIds'
            }
          }
        }
      }
    ]
  },

  /**
   * Assignment Policy as Focus Node
   *
   * When an Assignment Policy is the central focus, show:
   * - CONTEXTS: Contexts that trigger this policy (identities in these contexts get assigned)
   * - ENTITLEMENTS: Resources/entitlements assigned by this policy
   * - ACCOUNTS: Account resources assigned by this policy (if any)
   *
   * This view helps answer:
   * - "What does this policy grant?"
   * - "Who is affected by this policy?" (via contexts)
   * - "What resources are automatically assigned?"
   */
  [NodeTypes.ASSIGNMENT_POLICY]: {
    excludedLanes: [LaneTypes.ASSIGNMENT_POLICIES],
    lanes: [
      {
        laneType: LaneTypes.CONTEXTS,
        title: 'Triggering Contexts',
        description: 'Contexts that trigger this policy - identities in these contexts receive the assigned resources',
        required: true,
        apiSource: {
          type: 'derived',
          from: 'focusNode',
          extract: 'AP_CONTEXTS',
          transformTo: NodeTypes.CONTEXT
        },
        position: { x: -380, y: 0 },
        crossLaneFilters: {
          filtersLanes: [LaneTypes.IDENTITIES],
          filteredByLanes: [],
          filterType: CrossLaneFilterType.ARRAY_CONTAINS,
          filterMappings: {
            [LaneTypes.IDENTITIES]: {
              sourceField: 'id',
              targetField: 'contextIds'
            }
          }
        }
      },
      {
        laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
        title: 'Assigned Resources',
        description: 'Entitlement resources automatically assigned by this policy',
        required: true,
        apiSource: {
          type: 'derived',
          from: 'focusNode',
          extract: 'AP_RESOURCES',
          transformTo: NodeTypes.ENTITLEMENT
        },
        position: { x: 380, y: 0 },
        crossLaneFilters: {
          filtersLanes: [],
          filteredByLanes: [LaneTypes.CONTEXTS],
          filterMappings: {}
        }
      },
      {
        laneType: LaneTypes.ACCOUNTS,
        title: 'Assigned Account Resources',
        description: 'Account resources automatically assigned by this policy',
        required: false,  // Only show if policy has account resources
        apiSource: {
          type: 'derived',
          from: 'focusNode',
          extract: 'AP_ACCOUNTRESOURCES',
          transformTo: NodeTypes.ACCOUNT
        },
        position: { x: 0, y: 300 },
        crossLaneFilters: null
      },
      {
        laneType: LaneTypes.IDENTITIES,
        title: 'Affected Identities',
        description: 'Identities who receive resources from this policy (via context membership)',
        required: false,  // Optional - may require additional API call
        apiSource: {
          type: 'computed',
          from: 'contexts',
          query: 'getIdentitiesInContexts'  // Would need to fetch identities in the triggering contexts
        },
        position: { x: 0, y: -300 },
        crossLaneFilters: {
          filtersLanes: [],
          filteredByLanes: [LaneTypes.CONTEXTS],
          filterMappings: {}
        }
      }
    ]
  }
};

/**
 * Get required lane types for a focus node type
 * @param {string} focusNodeType - The NodeTypes value
 * @returns {Array<string>} Array of required LaneTypes
 */
export const getRequiredLanes = (focusNodeType) => {
  const config = LaneConfigSchema[focusNodeType];
  if (!config) return [];
  return config.lanes
    .filter(lane => lane.required === true)
    .map(lane => lane.laneType);
};

/**
 * Get cross-lane filter configuration for a specific lane in a focus node context
 * @param {string} focusNodeType - The NodeTypes value for the central node
 * @param {string} laneType - The LaneTypes value for the lane
 * @returns {Object|null} Cross-lane filter configuration or null
 */
export const getCrossLaneFilterConfig = (focusNodeType, laneType) => {
  const config = LaneConfigSchema[focusNodeType];
  if (!config) return null;
  const laneConfig = config.lanes.find(l => l.laneType === laneType);
  return laneConfig?.crossLaneFilters || null;
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
 * Resolve a field value from an object using schema-defined field mappings
 * This handles API response variations (OData vs GraphQL, case differences, etc.)
 *
 * @param {Object} obj - The object to extract from
 * @param {string} standardFieldName - The standard field name (e.g., 'displayName', 'id')
 * @param {string} nodeType - The NodeTypes value to get the schema
 * @returns {*} The resolved field value or null
 */
export const resolveField = (obj, standardFieldName, nodeType) => {
  if (!obj || !standardFieldName) return null;

  const schema = FocusNodeSchema[nodeType];
  if (!schema?.fieldMappings?.[standardFieldName]) {
    // No mapping defined - try the field name directly
    return obj[standardFieldName] ?? null;
  }

  // Try each possible field name from the mapping
  for (const fieldName of schema.fieldMappings[standardFieldName]) {
    const value = extractFieldValue(obj, fieldName);
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
};

/**
 * Normalize an object's fields using schema-defined field mappings
 * Returns a new object with standardized field names
 *
 * @param {Object} obj - The object to normalize
 * @param {string} nodeType - The NodeTypes value to get the schema
 * @returns {Object} New object with standardized field names
 */
export const normalizeFields = (obj, nodeType) => {
  if (!obj) return {};

  const schema = FocusNodeSchema[nodeType];
  if (!schema?.fieldMappings) {
    return { ...obj };
  }

  const normalized = {};

  // Apply each field mapping
  for (const [standardName, possibleNames] of Object.entries(schema.fieldMappings)) {
    const value = resolveField(obj, standardName, nodeType);
    if (value !== null && value !== undefined) {
      normalized[standardName] = value;
    }
  }

  // Include any fields not in the mapping
  for (const [key, value] of Object.entries(obj)) {
    if (!(key in normalized)) {
      normalized[key] = value;
    }
  }

  return normalized;
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

  // Fallback for node types not yet defined in LaneConfigSchema
  switch (nodeType) {
    case NodeTypes.IDENTITY:
      return [LaneTypes.SYSTEMS, LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.CONTEXTS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ROLES, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS];
    case NodeTypes.ROLE:
      return [LaneTypes.IDENTITIES, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.POLICIES];
    case NodeTypes.ENTITLEMENT:
      return [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS];
    case NodeTypes.SYSTEM:
      return [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.VIOLATIONS];
    case NodeTypes.LOGICAL_APPLICATION:
      return [LaneTypes.IDENTITIES, LaneTypes.SYSTEMS, LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS];
    case NodeTypes.ACCOUNT:
      return [LaneTypes.IDENTITIES, LaneTypes.SYSTEMS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.LOGICAL_APPLICATIONS];
    case NodeTypes.ASSIGNMENT_POLICY:
      return [LaneTypes.CONTEXTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.ACCOUNTS, LaneTypes.IDENTITIES];
    default:
      return [LaneTypes.IDENTITIES];
  }
};
