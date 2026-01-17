# Omada API Integration for React

This React application integrates with the Omada Identity Management API, providing a clean service layer and React hooks for common operations.

## Project Structure

```
src/
├── services/
│   ├── apiConfig.js          # API configuration and headers
│   └── omadaApi.js            # Main API service layer
├── utils/
│   └── queryBuilder.js        # OData and GraphQL query builders
├── hooks/
│   └── useOmadaApi.js         # Custom React Query hooks
└── components/
    └── identity/
        ├── IdentitySearch.jsx # Example identity search component
        └── IdentitySearch.css # Component styles
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_OMADA_BASE_URL=https://your-company.omada.cloud
VITE_OAUTH_BEARER_TOKEN=your-oauth-token
VITE_IMPERSONATE_USER=your.email@company.com
```

### 2. Install Dependencies

Already installed with this project:
- `@tanstack/react-query` (via @sisense/sdk-ui)
- React 19

### 3. Authentication

The API requires:
- **OAuth Bearer Token**: Get from your OAuth provider or `oauth_mcp_server`
- **User Impersonation**: Header with user email for delegated access

## API Service Layer

### Available API Methods

#### Identity API (`omadaApi.identity`)

```javascript
import { omadaApi } from './services/omadaApi';

// Search identities
const result = await omadaApi.identity.searchIdentities(
  { EMAIL: 'john@company.com' },
  bearerToken,
  impersonateUser
);

// Get identity by ID
const identity = await omadaApi.identity.getIdentityById(
  123,
  bearerToken,
  impersonateUser
);

// Get identity contexts (for access requests)
const contexts = await omadaApi.identity.getIdentityContexts(
  'identity-guid',
  bearerToken,
  impersonateUser
);
```

#### Access Request API (`omadaApi.accessRequest`)

```javascript
// Get all access requests
const requests = await omadaApi.accessRequest.getAccessRequests(
  bearerToken,
  impersonateUser
);

// Get resources for beneficiary
const resources = await omadaApi.accessRequest.getResourcesForBeneficiary(
  'identity-guid',
  bearerToken,
  impersonateUser,
  { systemId: 'system-guid' } // optional filters
);

// Create access request
const newRequest = await omadaApi.accessRequest.createAccessRequest(
  {
    identityUId: 'identity-guid',
    resourceId: 'resource-guid',
    contextId: 'context-guid',
    reason: 'Need access for project X',
    validFrom: '2024-01-01',
    validTo: '2025-01-01'
  },
  bearerToken,
  impersonateUser
);
```

#### Approval API (`omadaApi.approval`)

```javascript
// Get pending approvals
const approvals = await omadaApi.approval.getPendingApprovals(
  bearerToken,
  impersonateUser,
  'ResourceOwnerApproval' // optional workflow step filter
);

// Make approval decision
const result = await omadaApi.approval.makeApprovalDecision(
  'survey-guid',
  'survey-object-guid',
  'APPROVE', // or 'REJECT'
  bearerToken,
  impersonateUser
);
```

#### Assignment API (`omadaApi.assignment`)

```javascript
// Get calculated assignments
const assignments = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
  'identity-guid', // or array of guids
  bearerToken,
  impersonateUser,
  {
    // Optional filters
    resourceTypeName: 'Active Directory - Security Group',
    complianceStatus: 'NOT APPROVED',
    systemName: 'AD'
  },
  {
    // Optional pagination
    page: 1,
    rows: 50
  }
);
```

## React Hooks

### Using Custom Hooks with React Query

All hooks use React Query for automatic caching, refetching, and state management.

#### Identity Hooks

```javascript
import { useSearchIdentities, useGetIdentityContexts } from './hooks/useOmadaApi';

function MyComponent() {
  // Search identities
  const { data, isLoading, error } = useSearchIdentities(
    { EMAIL: 'john@company.com' },
    bearerToken,
    impersonateUser
  );

  // Get contexts
  const { data: contexts } = useGetIdentityContexts(
    identityUId,
    bearerToken,
    impersonateUser
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render data */}</div>;
}
```

#### Access Request Hooks

```javascript
import {
  useGetAccessRequests,
  useCreateAccessRequest,
  useGetResourcesForBeneficiary
} from './hooks/useOmadaApi';

function AccessRequestComponent() {
  // Get access requests
  const { data: requests } = useGetAccessRequests(bearerToken, impersonateUser);

  // Create access request (mutation)
  const createRequest = useCreateAccessRequest(bearerToken, impersonateUser);

  const handleCreate = async () => {
    await createRequest.mutateAsync({
      identityUId: 'guid',
      resourceId: 'guid',
      contextId: 'guid',
      reason: 'Need access'
    });
  };

  return (
    <button onClick={handleCreate} disabled={createRequest.isLoading}>
      {createRequest.isLoading ? 'Creating...' : 'Create Request'}
    </button>
  );
}
```

#### Approval Hooks

```javascript
import {
  useGetPendingApprovals,
  useMakeApprovalDecision
} from './hooks/useOmadaApi';

function ApprovalsComponent() {
  const { data: approvals } = useGetPendingApprovals(
    bearerToken,
    impersonateUser,
    'ResourceOwnerApproval'
  );

  const makeDecision = useMakeApprovalDecision(bearerToken, impersonateUser);

  const handleApprove = async (surveyId, surveyObjectKey) => {
    await makeDecision.mutateAsync({
      surveyId,
      surveyObjectKey,
      decision: 'APPROVE'
    });
  };

  return <div>{/* Render approvals */}</div>;
}
```

## Important Field Names

Omada OData API requires **UPPERCASE field names**:

- `EMAIL`, `FIRSTNAME`, `LASTNAME`, `DISPLAYNAME`
- `IDENTITYID`, `JOBTITLE`, `DEPARTMENT`, `COMPANY`
- `UId` (32-char GUID - use for GraphQL)
- `Id` (integer - use for OData)

## Query Builders

### OData Query Builder

```javascript
import { buildODataQuery, buildODataFilter } from './utils/queryBuilder';

// Build complete OData URL
const url = buildODataQuery(baseUrl, 'Identity', {
  filter: "contains(EMAIL, 'john')",
  select: 'EMAIL,FIRSTNAME,LASTNAME',
  top: 50,
  skip: 0,
  orderBy: 'DISPLAYNAME',
  count: true
});

// Build filter from object
const filter = buildODataFilter({
  EMAIL: 'john@company.com',
  DEPARTMENT: 'IT'
});
// Result: "contains(tolower(EMAIL), tolower('john@company.com')) and contains(tolower(DEPARTMENT), tolower('IT'))"
```

### GraphQL Query Templates

```javascript
import { GraphQLQueries } from './utils/queryBuilder';

// Pre-built GraphQL queries
const query = GraphQLQueries.getContextsForIdentity('identity-guid');
const query = GraphQLQueries.createAccessRequest(identityId, resourceId, contextId, reason);
const query = GraphQLQueries.getPendingApprovals('ResourceOwnerApproval');
```

## API Versions

Different GraphQL endpoints are used for different operations:

- **v1.1** (`/api/Domain/1.1`) - Mutations (createAccessRequest)
- **v2.19** (`/api/Domain/2.19`) - Calculated assignments queries
- **v3.0** (`/api/Domain/3.0`) - Most queries (default)

The service layer handles this automatically.

## Example Component

See `src/components/identity/IdentitySearch.jsx` for a complete working example of:
- Using custom hooks
- Handling loading and error states
- Displaying results
- Form handling

## Error Handling

All API methods return standardized error responses:

```javascript
{
  status: 'error',
  error_type: 'TypeError',
  message: 'Failed to fetch',
  context: 'searchIdentities',
  timestamp: '2024-12-12T10:30:00Z'
}
```

## Caching Strategy

React Query automatically caches responses with these default stale times:

- Identity searches: 5 minutes
- Identity details: 10 minutes
- Identity contexts: 15 minutes
- Access requests: 2 minutes (auto-refresh every 5 minutes)
- Approvals: 1 minute (auto-refresh every 3 minutes)
- Assignments: 5 minutes

## Best Practices

1. **Always pass `bearerToken` and `impersonateUser`** to API calls
2. **Use UId (GUID) for GraphQL**, `Id` (integer) for OData
3. **Field names must be UPPERCASE** for OData queries
4. **Enable hooks conditionally** - hooks won't run if required params are missing
5. **Use mutations for write operations** - they auto-invalidate cached queries
6. **Handle loading and error states** in your components

## Testing

To test the API integration:

1. Ensure your `.env` file is configured
2. Start the dev server: `npm run dev`
3. The date/time display will show, plus you can add the IdentitySearch component to test

## Next Steps

Extend the application by creating components for:
- **Access Request Creation Workflow** - Multi-step form (context → resources → create)
- **Approval Dashboard** - View and process pending approvals
- **Assignment Viewer** - Display user assignments with compliance status
- **Resource Browser** - Browse and search available resources

## Related Projects

This integration is based on the **omada-mcp-server** project, which provides the same functionality as an MCP server for Claude AI.
