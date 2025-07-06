# API Reference

This document provides a comprehensive reference for all APIs provided by the Task Master Issues system.

## Overview

The Task Master Issues system provides several API interfaces:
- **GitHub API Integration** - Enhanced GitHub API client with rate limiting and error handling
- **Sub-Issues API** - Manage hierarchical issue relationships
- **Configuration API** - Configure system behavior and thresholds
- **Artifact Management API** - Handle task graph artifacts and metadata

## GitHub API Integration

### EnhancedGitHubApi Class

The core API client that provides enhanced GitHub operations with automatic retry, rate limiting, and error recovery.

#### Constructor

```typescript
new EnhancedGitHubApi(config: GitHubApiConfig)
```

**Parameters:**
- `config`: Configuration object containing authentication and behavior settings

#### Core Methods

##### Issue Management

###### `createIssue(params: CreateIssueParams): Promise<GitHubIssue>`
Creates a new GitHub issue with enhanced error handling.

**Parameters:**
- `params.title`: Issue title
- `params.body`: Issue body content  
- `params.labels`: Array of label strings
- `params.assignees`: Array of assignee usernames

**Returns:** Promise resolving to the created issue

**Example:**
```typescript
const issue = await githubApi.createIssue({
  title: '[1.1] Setup Database',
  body: 'Configure initial database schema...',
  labels: ['taskmaster', 'database'],
  assignees: ['developer1']
});
```

###### `updateIssue(issueNumber: number, params: UpdateIssueParams): Promise<GitHubIssue>`
Updates an existing GitHub issue.

**Parameters:**
- `issueNumber`: Issue number to update
- `params`: Update parameters (title, body, labels, etc.)

###### `listIssues(options?: ListIssuesOptions): Promise<GitHubIssue[]>`
Lists issues with optional filtering.

**Parameters:**
- `options.state`: Filter by issue state ('open', 'closed', 'all')
- `options.labels`: Filter by labels
- `options.assignee`: Filter by assignee

##### Batch Operations

###### `batchOperation<T, R>(items: T[], processor: (item: T) => Promise<R>, options?: BatchOptions): Promise<BatchOperationResult<T>>`
Processes multiple items with controlled concurrency and error handling.

**Parameters:**
- `items`: Array of items to process
- `processor`: Function to process each item
- `options.concurrency`: Maximum concurrent operations (default: 3)
- `options.priority`: Operation priority level

**Returns:** Batch operation results with success/failure breakdown

##### Error Handling

###### `executeWithRetry<T>(operation: () => Promise<T>, operationType: string, priority?: OperationPriority): Promise<T>`
Executes an operation with automatic retry and rate limit handling.

**Parameters:**
- `operation`: Function to execute
- `operationType`: Description for logging
- `priority`: Operation priority (CRITICAL, HIGH, MEDIUM, LOW)

#### Error Categories

The API categorizes errors for appropriate handling:

- `GitHubErrorCategory.RATE_LIMITED`: Rate limit exceeded
- `GitHubErrorCategory.AUTH`: Authentication failures  
- `GitHubErrorCategory.VALIDATION`: Invalid request parameters
- `GitHubErrorCategory.NETWORK`: Network connectivity issues
- `GitHubErrorCategory.SERVER`: GitHub server errors
- `GitHubErrorCategory.TIMEOUT`: Request timeouts

## Sub-Issues API

### Overview
Manages hierarchical relationships between GitHub issues, providing parent-child task breakdown capabilities.

### Core Methods

#### `getSubIssues(issueNumber: number): Promise<ApiIssue[]>`
Retrieves all sub-issues for a parent issue.

**Process:**
1. Fetches parent issue body
2. Parses sub-issue references using regex patterns
3. Fetches each referenced sub-issue
4. Returns array of sub-issue objects

**Supported Body Formats:**
```markdown
## Subtasks
- [ ] #123 Setup database
- [x] #124 Create API endpoints

## Required By
- [ ] #200 Frontend implementation
```

#### `addSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void>`
Establishes a parent-child relationship between issues.

**Process:**
1. Fetches both parent and sub-issue
2. Adds sub-issue reference to parent body under "Subtasks" section
3. Adds parent reference to sub-issue body in "Meta" section
4. Updates both issues via GitHub API

#### `removeSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void>`
Removes a sub-issue relationship.

**Process:**
1. Fetches both issues
2. Removes references from both issue bodies
3. Updates both issues

### Body Content Parsing

The system recognizes these relationship patterns:

#### Subtasks Section
```markdown
## Subtasks
- [ ] #123
- [x] #456
```

#### Required By Section  
```markdown
## Required By
- [ ] #200
- [x] #300

- **Required By:**
  - [ ] #400
```

## Configuration API

### Configuration Structure

```typescript
interface TaskmasterConfig {
  complexity_threshold: number;
  max_depth: number;
  dry_run: boolean;
  github: {
    token: string;
    owner: string;
    repo: string;
  };
}
```

### Configuration Methods

#### `loadConfig(configPath?: string): TaskmasterConfig`
Loads configuration from file or environment variables.

#### `validateConfig(config: TaskmasterConfig): ValidationResult`
Validates configuration parameters and returns validation errors.

## Artifact Management API

### Artifact Operations

#### `uploadArtifact(name: string, content: any, metadata: ArtifactMetadata): Promise<void>`
Uploads task graph artifacts with structured metadata.

**Metadata Fields:**
- `prd_version`: Version from PRD file
- `generation_timestamp`: ISO timestamp  
- `complexity_threshold`: Task complexity threshold used
- `total_tasks`: Count of all tasks and subtasks
- `task_hierarchy_depth`: Maximum depth of task hierarchy

#### `downloadArtifact(name: string): Promise<ArtifactData>`
Downloads and validates artifact content.

#### `listArtifacts(options?: ListOptions): Promise<ArtifactSummary[]>`
Lists available artifacts with metadata.

## Error Handling Patterns

### Retry Strategies

1. **Immediate Retry**: Connection resets, temporary network issues
2. **Delayed Retry**: Rate limits, server overload (exponential backoff)
3. **Rollback and Retry**: Data validation errors, partial failures  
4. **Manual Intervention**: Authentication failures, critical errors

### Circuit Breaker

Prevents cascade failures by temporarily blocking requests after repeated failures:

```typescript
// Circuit breaker states
enum CircuitState {
  CLOSED,    // Normal operation
  OPEN,      // Blocking requests
  HALF_OPEN  // Testing recovery
}
```

### Rate Limiting

- Automatic detection of rate limit headers
- Priority queue for critical operations
- Exponential backoff with jitter
- Health-based recovery detection

## Priority Levels

Operations can be assigned priority levels:

```typescript
enum OperationPriority {
  CRITICAL,  // Bypass normal queue delays
  HIGH,      // Elevated priority
  MEDIUM,    // Default priority  
  LOW        // Background operations
}
```

## Usage Examples

### Basic Issue Creation
```typescript
const api = new EnhancedGitHubApi(config);

const issue = await api.createIssue({
  title: '[2.1] Implement Authentication',
  body: 'Add user authentication system...',
  labels: ['feature', 'authentication']
});
```

### Batch Operations
```typescript
const results = await api.batchOperation(
  tasks,
  async (task) => await api.createIssue(task),
  { concurrency: 5, priority: OperationPriority.HIGH }
);

console.log(`Created ${results.successful.length} issues`);
```

### Sub-Issue Management
```typescript
// Create parent-child relationship
await api.addSubIssue(parentIssue.number, childIssue.number);

// Get all sub-issues
const subIssues = await api.getSubIssues(parentIssue.number);
```

### Error Handling
```typescript
try {
  const result = await api.executeWithRetry(
    () => api.createIssue(issueData),
    'create-critical-issue',
    OperationPriority.CRITICAL
  );
} catch (error) {
  const apiError = error as GitHubApiError;
  
  switch (apiError.category) {
    case GitHubErrorCategory.RATE_LIMITED:
      // Handled automatically by retry logic
      break;
    case GitHubErrorCategory.AUTH:
      console.log('Check token permissions');
      break;
  }
}
```

## Best Practices

1. **Use Priority Levels**: Assign appropriate priority to operations
2. **Handle Errors Gracefully**: Check error categories for proper handling
3. **Batch Operations**: Use batch processing for multiple operations
4. **Monitor Health**: Check API health metrics regularly
5. **Respect Rate Limits**: Use built-in rate limiting features

## Related Documentation

- [GitHub API Integration](./github-api-integration.md) - Implementation details
- [Sub-Issues API Integration](./sub-issues-api-integration.md) - Sub-issue system details  
- [Configuration Management](./configuration-management.md) - Configuration options
- [Error Handling](./comprehensive-error-handling.md) - Error recovery workflows