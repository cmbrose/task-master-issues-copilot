# Enhanced GitHub API Integration

This document describes the enhanced GitHub API integration implemented for issue #230, providing robust GitHub API operations with comprehensive error handling, rate limiting, and concurrency management.

## Overview

The enhanced GitHub API integration provides:

- **Rate Limiting Handling**: Automatic detection and handling of GitHub API rate limits with exponential backoff
- **Comprehensive Error Handling**: Categorized error handling with intelligent retry strategies
- **Idempotency Checks**: Improved duplicate detection using GitHub's search API
- **Concurrent Request Management**: Proper queuing and concurrency control for API requests
- **Detailed Logging**: Comprehensive logging and recovery mechanisms

## Key Features

### 1. Rate Limiting Management

The system automatically handles GitHub API rate limits:

```typescript
// Automatic rate limit detection from response headers
private updateRateLimitInfo(headers: any): void {
  const remaining = parseInt(headers['x-ratelimit-remaining']) || 0;
  const limit = parseInt(headers['x-ratelimit-limit']) || 5000;
  const reset = parseInt(headers['x-ratelimit-reset']) || 0;
  // ... automatic handling
}
```

**Features:**
- Real-time rate limit tracking from API response headers
- Automatic request queuing when rate limited
- Smart timing based on reset timestamps
- Progressive backoff for secondary rate limits

### 2. Error Categorization and Retry Logic

Errors are categorized for appropriate handling:

```typescript
export enum GitHubErrorCategory {
  RATE_LIMITED = 'rate_limited',  // 429 - Always retryable
  NETWORK = 'network',            // Connection issues - Retryable  
  AUTH = 'auth',                  // 401/403 - Not retryable
  NOT_FOUND = 'not_found',        // 404 - Not retryable
  VALIDATION = 'validation',      // 422 - Not retryable
  SERVER = 'server',              // 5xx - Retryable
  UNKNOWN = 'unknown'             // Other errors - Contextual
}
```

**Retry Strategy:**
- Exponential backoff with jitter for retryable errors
- Respect `Retry-After` headers when provided
- Maximum retry limits to prevent infinite loops
- Different backoff strategies per error category

### 3. Concurrent Request Management

Request queue system manages API concurrency:

```typescript
interface QueueItem {
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  category: string;
}
```

**Features:**
- Configurable maximum concurrent requests (default: 3)
- FIFO queue processing with retry prioritization
- Operation categorization for better debugging
- Graceful degradation under rate limits

### 4. Enhanced Issue Management

Improved issue operations with better idempotency:

```typescript
// Enhanced duplicate detection using GitHub Search API
async findExistingIssue(title: string, uniqueMarker?: string): Promise<ApiIssue | null> {
  const searchQuery = `repo:${owner}/${repo} in:title "${title}"`;
  // ... search and validate with unique markers
}
```

**Improvements:**
- Uses GitHub Search API for better duplicate detection
- Supports unique markers for precise matching
- Handles edge cases in title matching
- Reduces false positives in issue detection

## Configuration

The enhanced API client supports comprehensive configuration:

```typescript
const githubApi = createGitHubApiClient({
  token: GITHUB_TOKEN,
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
  maxConcurrent: 3,        // Max concurrent requests
  retryDelay: 1000,        // Base retry delay (ms)
  maxRetries: 3,           // Max retry attempts
  debug: false             // Enable debug logging
});
```

## Usage Examples

### Basic Issue Creation

```typescript
// Create issue with automatic retry and rate limiting
const issue = await githubApi.createIssue({
  title: "Feature Request",
  body: "Description of the feature",
  labels: ['enhancement']
});
```

### Batch Operations with Concurrency Control

```typescript
// Process multiple issues with automatic queuing
const issues = await Promise.all(
  tasks.map(task => githubApi.createIssue({
    title: task.title,
    body: task.description,
    labels: ['taskmaster']
  }))
);

// Wait for all operations to complete
await githubApi.waitForCompletion();
```

### Sub-Issues API Integration

Enhanced support for issue hierarchy management:

```typescript
// Find sub-issues for a parent issue
const subIssues = await githubApi.findSubIssues(parentIssue);

// Establish parent-child relationship
await githubApi.addSubIssueRelationship(parentIssue, childIssue);

// Remove sub-issue relationship
await githubApi.removeSubIssueRelationship(parentIssue, childIssue);
```

**Sub-Issues Features:**
- Multiple detection strategies (YAML front-matter, labels, issue references)
- Automatic parent reference management in issue descriptions
- Label-based relationship tracking (`parent:123`)
- Integration with GitHub search API for relationship discovery
- Comprehensive error handling with fallback mechanisms

### Error Handling

```typescript
try {
  const issue = await githubApi.createIssue(params);
} catch (error) {
  const apiError = error as GitHubApiError;
  
  switch (apiError.category) {
    case GitHubErrorCategory.RATE_LIMITED:
      console.log('Rate limited - already handled by retry logic');
      break;
    case GitHubErrorCategory.AUTH:
      console.log('Authentication failed - check token permissions');
      break;
    case GitHubErrorCategory.VALIDATION:
      console.log('Invalid request parameters');
      break;
  }
}
```

## Monitoring and Debugging

### Queue Status Monitoring

```typescript
const status = githubApi.getQueueStatus();
console.log(`Queue: ${status.pending} pending, ${status.active} active`);
console.log(`Rate limited: ${status.rateLimited}`);
```

### Rate Limit Status

```typescript
const rateLimitInfo = await githubApi.getRateLimitStatus();
console.log(`Rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`);
console.log(`Resets at: ${new Date(rateLimitInfo.reset * 1000)}`);
```

### Debug Logging

Enable detailed logging for troubleshooting:

```typescript
const githubApi = createGitHubApiClient({
  // ... other config
  debug: true  // Enables detailed operation logging
});
```

## Error Recovery

The system provides several recovery mechanisms:

1. **Automatic Retry**: Retryable errors are automatically retried with exponential backoff
2. **Queue Persistence**: Operations remain in queue during rate limit periods
3. **Graceful Degradation**: Non-critical failures don't block other operations
4. **Resource Cleanup**: Proper cleanup of timers and resources on shutdown

## Performance Considerations

- **Concurrency Limits**: Default 3 concurrent requests to avoid overwhelming the API
- **Memory Management**: Request queue is bounded and cleaned up after completion
- **Network Efficiency**: Proper use of search API reduces unnecessary list operations
- **Rate Limit Optimization**: Proactive rate limit management reduces wait times

## Migration from Basic Octokit

The enhanced API maintains compatibility while adding robustness:

```typescript
// Before (basic Octokit)
const response = await octokit.issues.create({
  owner, repo, title, body
});

// After (enhanced API)  
const issue = await githubApi.createIssue({
  title, body
});
```

Key differences:
- Automatic error handling and retries
- Built-in rate limiting management
- Better duplicate detection
- Comprehensive logging and monitoring

## Testing

Run the included tests to verify functionality:

```bash
# Test compilation and module structure
./test/test-github-api-simple.sh

# Test full integration (if GitHub token available)
export GITHUB_TOKEN=your_token
export GITHUB_OWNER=owner
export GITHUB_REPO=repo
npm run start
```

## Limitations and Future Enhancements

### Current Limitations

1. **Sub-issue API**: GitHub's sub-issue API is not universally available, so sub-issue relationships are handled gracefully
2. **Webhook Events**: Does not currently handle webhook-based updates
3. **Bulk Operations**: No specialized bulk operation APIs

### Future Enhancements

1. **GraphQL Support**: Migrate to GraphQL API for more efficient operations
2. **Webhook Integration**: Add support for real-time updates via webhooks
3. **Caching Layer**: Add intelligent caching for frequently accessed data
4. **Metrics Collection**: Add detailed metrics and performance monitoring