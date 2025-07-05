# Enhanced GitHub API Integration

This document describes the enhanced GitHub API integration with comprehensive error handling, rate limiting, circuit breaker patterns, and graceful degradation implemented for issue #237.

## Overview

The enhanced GitHub API integration provides:

- **Rate Limiting Handling**: Automatic detection and handling of GitHub API rate limits with exponential backoff
- **Comprehensive Error Handling**: Categorized error handling with intelligent retry strategies
- **Circuit Breaker Pattern**: Automatic failure detection and recovery with configurable thresholds
- **Priority Queue Management**: Request prioritization for critical vs non-critical operations
- **Graceful Degradation**: Continues operation with reduced functionality during failures
- **Idempotency Checks**: Improved duplicate detection using GitHub's search API
- **Concurrent Request Management**: Proper queuing and concurrency control for API requests
- **Health Monitoring**: Built-in health checks and comprehensive metrics
- **Detailed Logging**: Enhanced logging with levels and structured error reporting

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

### 2. Enhanced Error Categorization and Retry Logic

Errors are categorized for appropriate handling:

```typescript
export enum GitHubErrorCategory {
  RATE_LIMITED = 'rate_limited',    // 429 - Always retryable
  NETWORK = 'network',              // Connection issues - Retryable  
  AUTH = 'auth',                    // 401/403 - Not retryable
  NOT_FOUND = 'not_found',          // 404 - Not retryable
  VALIDATION = 'validation',        // 422 - Not retryable
  SERVER = 'server',                // 5xx - Retryable
  TIMEOUT = 'timeout',              // Operation timeouts - Retryable
  CIRCUIT_BREAKER = 'circuit_breaker', // Circuit breaker open - Not retryable
  UNKNOWN = 'unknown'               // Other errors - Contextual
}
```
```

**Retry Strategy:**
- Exponential backoff with jitter for retryable errors
- Respect `Retry-After` headers when provided
- Maximum retry limits to prevent infinite loops
- Different backoff strategies per error category:
  - **Timeout errors**: Faster retry (max 5 seconds)
  - **Network errors**: Medium retry (max 10 seconds)  
  - **Server errors**: Standard retry (max 30 seconds)
  - **Rate limits**: Aggressive backoff (max 1 minute)

### 3. Circuit Breaker Pattern

Automatic failure detection and recovery:

```typescript
export enum CircuitBreakerState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failures detected, requests blocked
  HALF_OPEN = 'half_open' // Testing if service recovered
}
```

**Features:**
- Configurable failure threshold (default: 5 failures)
- Automatic state transitions based on success/failure patterns
- Manual reset capabilities for administrative recovery
- Timeout-based automatic retry attempts

### 4. Priority Queue Management

Operations are prioritized for optimal handling:

```typescript
export enum OperationPriority {
  CRITICAL = 'critical',    // Must succeed (auth, rate limit checks)
  HIGH = 'high',           // Important (create/update issues)
  MEDIUM = 'medium',       // Nice to have (list operations)
  LOW = 'low'             // Optional (metrics, cache updates)
}
```

**Features:**
- Automatic priority-based queue insertion
- Critical operations bypass normal queuing delays
- Resource allocation based on operation importance

### 5. Enhanced Monitoring and Metrics

Comprehensive error tracking and health monitoring:

```typescript
// Get detailed error metrics
const metrics = client.getErrorMetrics();
// Returns: { total, byCategory, byOperation, recentFailures }

// Check circuit breaker status
const cbStatus = client.getCircuitBreakerStatus(); 
// Returns: { state, failureCount, lastFailureTime, lastSuccessTime }

// Perform health check
const health = await client.performHealthCheck();
// Returns: { healthy, details: { responseTime, errorRate, ... } }
```

### 6. Concurrent Request Management

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

### 7. Enhanced Issue Management

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
  
  // Basic settings
  maxConcurrent: 3,                   // Max concurrent requests
  retryDelay: 1000,                   // Base retry delay (ms)
  maxRetries: 3,                      // Max retry attempts
  debug: false,                       // Enable debug logging
  
  // Enhanced error handling
  enableCircuitBreaker: true,         // Enable circuit breaker
  circuitBreakerThreshold: 5,         // Failures before opening
  circuitBreakerTimeout: 60000,       // Reset attempt delay (ms)
  enableGracefulDegradation: true,    // Enable graceful degradation
  operationTimeout: 30000             // Individual operation timeout (ms)
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

### Priority-Based Operations

```typescript
import { OperationPriority } from './scripts/github-api';

// Critical operation (bypasses normal queue delays)
const issue = await githubApi.executeWithRetry(
  () => githubApi.createIssue(params),
  'create-critical-issue',
  OperationPriority.CRITICAL
);

// Standard priority operations
const issues = await githubApi.listIssues(); // MEDIUM priority by default
```

### Health Monitoring

```typescript
// Perform comprehensive health check
const health = await githubApi.performHealthCheck();
if (health.healthy) {
  console.log(`API healthy, response time: ${health.details.responseTime}ms`);
} else {
  console.error(`API unhealthy: ${health.details.error}`);
}

// Monitor error metrics
const metrics = githubApi.getErrorMetrics();
console.log(`Total errors: ${metrics.total}`);
console.log(`Recent error rate: ${metrics.recentFailures.length} in last 10 minutes`);

// Monitor circuit breaker status
const cbStatus = githubApi.getCircuitBreakerStatus();
console.log(`Circuit breaker: ${cbStatus.state}, failures: ${cbStatus.failureCount}`);
```

### Administrative Recovery

```typescript
// Manually reset circuit breaker after resolving issues
githubApi.resetCircuitBreaker();

// Clear error metrics for fresh monitoring
githubApi.clearErrorMetrics();
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

### Enhanced Debug Logging

Enable detailed logging with multiple levels:

```typescript
const githubApi = createGitHubApiClient({
  // ... other config
  debug: true  // Enables detailed operation logging
});

// Logging levels automatically used:
// - ERROR: Critical failures, circuit breaker events
// - WARN: Retries, degraded mode, rate limiting  
// - INFO: Successful operations, state changes
// - DEBUG: Detailed operation traces (when debug=true)
```

### Error Metrics and Analytics

```typescript
// Get comprehensive error statistics
const metrics = githubApi.getErrorMetrics();
console.log(`Total errors: ${metrics.total}`);
console.log(`Network errors: ${metrics.byCategory.network}`);
console.log(`Auth errors: ${metrics.byCategory.auth}`);
console.log(`Errors by operation:`, metrics.byOperation);

// Analyze recent failure patterns
metrics.recentFailures.forEach(failure => {
  console.log(`${failure.timestamp}: ${failure.category} in ${failure.operation}`);
});
```

## Enhanced Error Recovery

The system provides comprehensive recovery mechanisms:

1. **Automatic Retry**: Retryable errors are automatically retried with category-specific exponential backoff
2. **Circuit Breaker Protection**: Prevents cascade failures by temporarily blocking requests after repeated failures
3. **Priority Queue Recovery**: Critical operations can bypass failed queues
4. **Graceful Degradation**: Non-critical failures don't block other operations
5. **Health-Based Recovery**: Automatic service health monitoring and recovery detection
6. **Resource Cleanup**: Proper cleanup of timers and resources on shutdown

### Circuit Breaker Recovery

```typescript
// Circuit breaker automatically transitions:
// CLOSED -> OPEN (after threshold failures)
// OPEN -> HALF_OPEN (after timeout period)  
// HALF_OPEN -> CLOSED (on first success) or OPEN (on failure)

// Manual intervention when needed:
if (cbStatus.state === 'open') {
  // Wait for automatic recovery or manually reset
  await new Promise(resolve => setTimeout(resolve, 60000));
  githubApi.resetCircuitBreaker();
}
```

### Graceful Degradation Examples

The system attempts graceful degradation for critical operations:

- **Network errors**: Continue with cached data when possible
- **Rate limiting**: Use priority queuing to ensure critical operations complete
- **Timeout errors**: Retry with simplified requests
- **Server errors**: Fall back to read-only operations when writes fail

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