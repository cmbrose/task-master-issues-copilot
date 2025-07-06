# Sub-Issues API Integration

This document describes the sub-issues API integration implemented for issue #233, providing comprehensive sub-issue relationship management through GitHub API operations.

## Overview

The sub-issues API integration provides:

- **Sub-Issue Relationship Parsing**: Parse existing sub-issue relationships from GitHub issue bodies
- **Sub-Issue Retrieval**: API methods to retrieve all sub-issues for a given parent issue
- **Relationship Management**: Add and remove sub-issue relationships between issues
- **Body Content Updates**: Automatically update issue body content to reflect sub-issue relationships
- **Rate Limiting**: Full integration with existing GitHub API rate limiting and error handling

## Key Features

### 1. Sub-Issue Relationship Parsing

The system can parse sub-issue relationships from various formats in issue bodies:

```markdown
## Subtasks
   - [ ] #123
   - [x] #456
   - [ ] #789

- **Required By:**
   - [ ] #200
   - [x] #300
```

### 2. Sub-Issue Retrieval

```typescript
// Get all sub-issues for a parent issue
const subIssues = await githubApi.getSubIssues(parentIssueNumber);
```

### 3. Sub-Issue Relationship Management

```typescript
// Add a sub-issue relationship
await githubApi.addSubIssue(parentIssueNumber, subIssueNumber);

// Remove a sub-issue relationship
await githubApi.removeSubIssue(parentIssueNumber, subIssueNumber);
```

## API Methods

### `getSubIssues(issueNumber: number): Promise<ApiIssue[]>`

Retrieves all sub-issues for a given parent issue by:
1. Fetching the parent issue body
2. Parsing sub-issue references from the body content
3. Fetching each referenced sub-issue
4. Returning the array of sub-issues

### `addSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void>`

Establishes a sub-issue relationship by:
1. Fetching both parent and sub-issue
2. Adding sub-issue reference to parent issue body under "## Subtasks" section
3. Adding parent reference to sub-issue body in "## Meta" section
4. Updating both issues via GitHub API

### `removeSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void>`

Removes a sub-issue relationship by:
1. Fetching both parent and sub-issue
2. Removing sub-issue reference from parent issue body
3. Removing parent reference from sub-issue body
4. Updating both issues via GitHub API

## Body Format Parsing

The system recognizes these patterns for sub-issue relationships:

### Subtasks Section (Markdown Header)
```markdown
## Subtasks
   - [ ] #123
   - [x] #456
```

### Required By Section (Various Formats)
```markdown
## Required By
   - [ ] #200
   - [x] #300

- **Required By:**
   - [ ] #400
```

## Integration with Existing Systems

### Rate Limiting
All sub-issue API methods use the existing `executeWithRetry` mechanism for:
- Exponential backoff retry logic
- Rate limit detection and handling
- Comprehensive error categorization

### Error Handling
The implementation provides graceful degradation:
- Failed sub-issue fetches are logged but don't block other operations
- Network errors are handled with automatic retries
- Malformed issue bodies are handled gracefully

### Authentication
Uses the existing GitHub API client authentication and configuration.

## Testing

Run the sub-issues API tests:

```bash
npm run test:sub-issues-api
```

This tests:
- Sub-issue relationship parsing from various body formats
- Adding sub-issue references to parent issue bodies
- Adding parent references to sub-issue bodies  
- Body content manipulation functions

## Usage in Create Issues Script

The `create-issues.ts` script automatically uses the new sub-issue API methods:

1. **Loading existing relationships**: When creating parent issues, `getSubIssues()` is called to populate existing sub-issue relationships
2. **Creating new relationships**: When creating subtasks, `addSubIssue()` is called to establish the parent-child relationship
3. **Error handling**: Failed operations are logged but don't prevent the script from continuing

## Future Enhancements

Potential improvements:
- Support for nested sub-issue hierarchies
- Bulk sub-issue operations
- Sub-issue relationship validation
- Integration with GitHub Projects v2 for visual hierarchy representation

## Migration from Placeholder Functions

The implementation replaces the previous placeholder functions:
- `getSubIssues()` now performs actual GitHub API calls instead of returning empty arrays
- `addSubIssue()` now updates GitHub issue bodies instead of just updating in-memory structures
- Full error handling and rate limiting integration added