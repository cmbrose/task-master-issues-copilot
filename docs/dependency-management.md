# Issue Hierarchy and Dependency Management

This document describes the implementation of issue hierarchy and dependency management features in the Taskmaster GitHub Actions.

## Features Implemented

### 1. YAML Front-matter Support

Issues now include structured metadata in YAML front-matter format at the beginning of issue descriptions:

```yaml
---
id: 4
parent: 3
dependencies: [1, 2]
dependents: [5, 6]
status: pending
priority: high
---

## Details
Issue content continues here...
```

**Fields:**
- `id`: Unique identifier for the task
- `parent`: Parent task ID (for subtasks)
- `dependencies`: Array of task IDs this task depends on
- `dependents`: Array of task IDs that depend on this task
- `status`: Current status (pending, in-progress, completed, etc.)
- `priority`: Priority level (low, medium, high, critical)

### 2. Automatic Blocked Status Management

The system automatically manages the `blocked` label on issues:

- **Blocked**: Applied to issues that have open dependencies
- **Unblocked**: Label removed when all dependencies are closed
- **Real-time**: Updates triggered by issue closure events
- **Batch processing**: Periodic full scans to ensure consistency

### 3. Sub-issues API Integration

Enhanced integration with GitHub's Sub-issues REST API:

```typescript
// Create parent-child relationships
await octokit.issues.addSubIssue({
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO, 
  issue_number: parentIssue.number,
  sub_issue_id: subIssue.id,
});

// Fetch sub-issues
const subIssues = await octokit.issues.listSubIssues({
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
  issue_number: issue.number,
});
```

**Error Handling:**
- Graceful fallback when Sub-issues API is unavailable
- Relationship tracking via YAML front-matter as backup
- Comprehensive logging for debugging

### 4. Dependency Resolution Engine

The taskmaster-watcher action monitors for dependency resolution:

**Webhook Mode:**
- Triggered by `issues.closed` events
- Processes single issue closure
- Updates dependent issues immediately

**Full Scan Mode:**
- Triggered by cron schedule (every 10 minutes)
- Scans all blocked issues
- Ensures consistency across the entire issue graph

### 5. Complex Dependency Chain Support

Supports arbitrary dependency graphs including:
- Linear dependency chains
- Parallel dependencies
- Diamond dependencies
- Circular dependency detection (prevents infinite loops)

## Usage

### Creating Issues with Dependencies

The `create-issues.ts` script automatically generates YAML front-matter:

```bash
npm run build
GITHUB_TOKEN=your_token GITHUB_OWNER=owner GITHUB_REPO=repo node create-issues.js
```

### Monitoring Dependencies

The watcher action runs automatically on issue closure:

```yaml
name: Dependency Watcher
on:
  issues:
    types: [closed]
  schedule:
    - cron: '*/10 * * * *'

jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - uses: ./actions/taskmaster-watcher
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          scan-mode: ${{ github.event_name == 'schedule' && 'full' || 'webhook' }}
```

## Testing

### Running Tests

```bash
# Test YAML front-matter parsing
node tests/test-yaml-parsing.js

# Test dependency resolution logic
node tests/test-dependency-resolution.js

# Test full integration scenario
node tests/test-integration.js
```

### Test Coverage

The tests cover:
- YAML front-matter parsing and generation
- Dependency resolution algorithms
- Complex dependency chain scenarios
- Error handling for malformed data
- Edge cases and boundary conditions

### Example Test Scenario

The integration test simulates a realistic dependency chain:

1. **Setup Foundation** (ID: 1) - No dependencies ✅ Completed
2. **Build Core Features** (ID: 2) - Depends on [1] → Should be unblocked
3. **Add UI Components** (ID: 3) - Depends on [2] → Should be blocked
4. **Testing Framework** (ID: 4) - Depends on [1] → Should be unblocked  
5. **Integration Tests** (ID: 5) - Depends on [3, 4] → Should be blocked
6. **Documentation** (ID: 6) - Depends on [5] → Should be blocked

## API Reference

### YAML Front-matter Schema

```typescript
interface IssueFrontMatter {
  id?: string | number;
  parent?: string | number; 
  dependencies?: (string | number)[];
  dependents?: (string | number)[];
  status?: string;
  priority?: string;
}
```

### Core Functions

```typescript
// Parse YAML front-matter from issue body
function parseYamlFrontMatter(body: string): { frontMatter: any; content: string }

// Create YAML front-matter for a task
function createYamlFrontMatter(task: Task, parentTask?: Task): any

// Check if issue should be blocked
function isIssueBlocked(task: Task, idToIssue: Record<string, Issue>): boolean

// Update blocked label on issue
function updateBlockedLabel(issue: Issue, shouldBeBlocked: boolean): Promise<void>

// Check if all dependencies are closed
function areAllDependenciesClosed(issue: any, allIssues: any[]): Promise<boolean>

// Find issues that depend on a specific task
function findDependentIssues(closedIssueId: string | number, allIssues: any[]): any[]
```

## Error Handling

The implementation includes comprehensive error handling:

1. **Sub-issues API Failures**: Graceful fallback to YAML-only tracking
2. **Malformed YAML**: Continues with empty front-matter object
3. **Missing Dependencies**: Handles references to non-existent tasks
4. **API Rate Limits**: Includes retry logic and exponential backoff
5. **Network Failures**: Robust error recovery mechanisms

## Performance Considerations

- **Batch Processing**: Full scans process issues in batches
- **Caching**: Issue data cached to minimize API calls
- **Incremental Updates**: Webhook mode only processes affected issues
- **Rate Limiting**: Respects GitHub API rate limits with backoff

## Security

- **Token Management**: Secure handling of GitHub tokens
- **Input Validation**: Sanitizes YAML content before parsing
- **Permission Checks**: Requires appropriate GitHub permissions
- **Audit Logging**: Comprehensive logging for debugging and monitoring