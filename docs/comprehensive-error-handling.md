# Comprehensive Error Handling and Recovery Workflows

## Overview

The comprehensive error handling and recovery system provides robust error management capabilities for the Taskmaster GitHub Actions, including:

- **Correlation tracking** for operation chains
- **Enhanced error categorization** (transient vs permanent)
- **Automatic retry logic** with intelligent backoff strategies
- **Rollback mechanisms** for partial failures
- **Structured logging** with correlation IDs
- **Integration with replay workflows** for manual recovery operations

## Architecture

### Core Components

#### 1. Correlation Tracking System (`correlation-tracking.ts`)

Provides correlation IDs for tracking related operations across error handling, recovery workflows, and logging systems.

**Key Features:**
- Unique correlation ID generation for operation chains
- Parent-child relationship tracking for nested operations
- Operation chain reconstruction for debugging
- Automatic context management with cleanup

**Usage:**
```typescript
import { CorrelationTracker } from './scripts/correlation-tracking';

const tracker = CorrelationTracker.getInstance();

// Manual context management
const context = tracker.startContext('github_operation', { repo: 'test' });
// ... perform operations
tracker.endContext(context.correlationId);

// Automatic context management
await tracker.withCorrelation('batch_process', async (context) => {
  // Operations automatically tracked with correlation ID
});
```

#### 2. Error Categorization System (`error-categorization.ts`)

Comprehensive error classification to distinguish between transient and permanent errors for appropriate recovery strategies.

**Error Types:**
- **Transient**: Network timeouts, connection resets, server errors
- **Permanent**: Validation errors, resource not found, authentication failures
- **Recoverable**: Conflicts, file system errors, rate limits
- **Unknown**: Unclassified errors requiring manual review

**Recovery Strategies:**
- `IMMEDIATE_RETRY`: Quick retry for connection issues
- `DELAYED_RETRY`: Exponential backoff for transient errors
- `ROLLBACK_RETRY`: Rollback state before retry
- `MANUAL_INTERVENTION`: Requires human intervention
- `FALLBACK`: Use degraded mode
- `SKIP`: Skip operation and continue
- `ABORT`: Stop entire operation

**Usage:**
```typescript
import { ErrorCategorizer } from './scripts/error-categorization';

const error = new Error('Network timeout occurred');
const classified = ErrorCategorizer.classifyError(error);

console.log(classified.classification.recoverability); // 'transient'
console.log(classified.classification.retryable); // true
console.log(classified.classification.maxRetries); // 5
```

#### 3. Error Recovery Coordinator (`error-recovery-coordinator.ts`)

Central coordinator for comprehensive error recovery workflows, integrating retry logic, rollback mechanisms, and manual recovery operations.

**Features:**
- Automatic recovery strategy execution
- Replay artifact creation for manual recovery
- Recovery statistics and reporting
- Custom strategy support
- Recovery history tracking

**Usage:**
```typescript
import { ErrorRecoveryCoordinator } from './scripts/error-recovery-coordinator';

const coordinator = new ErrorRecoveryCoordinator(
  idempotencyManager,
  artifactRecovery,
  {
    enableReplayArtifacts: true,
    enableAutoRollback: true
  }
);

const result = await coordinator.recoverFromError(
  error,
  async () => {
    // Operation to retry
    return await githubApi.createIssue(issueData);
  }
);

if (result.success) {
  console.log('Recovery successful');
} else if (result.manualInterventionRequired) {
  console.log(`Manual intervention needed: ${result.replayArtifactId}`);
}
```

#### 4. Structured Logging System (`structured-logging.ts`)

Enhanced logging with correlation tracking, structured formatting, and integration with error recovery workflows.

**Features:**
- Correlation ID integration
- Performance measurement
- Log filtering and correlation tracing
- Multiple output formats (console, JSON, CSV)
- Operation lifecycle logging

**Usage:**
```typescript
import { getLogger, LogCategory } from './scripts/structured-logging';

const logger = getLogger();

// Basic logging with correlation
logger.info('Starting GitHub operation', LogCategory.GITHUB_API, {
  repository: 'test-repo',
  operation: 'create_issue'
});

// Operation lifecycle logging
logger.logOperationStart('issue_creation', { issueCount: 5 });
// ... perform operation
logger.logOperationComplete('issue_creation', true, { created: 5 });

// Error recovery logging
logger.logErrorRecovery('retry_attempt', classifiedError, 2, 5);
```

## Error Recovery Workflows

### Automatic Recovery Process

1. **Error Classification**: Incoming errors are automatically categorized
2. **Strategy Selection**: Recovery strategy selected based on error type
3. **Recovery Execution**: Appropriate recovery actions taken
4. **Result Tracking**: Recovery results recorded for analysis

### Recovery Strategies

#### Immediate Retry
- **Use Case**: Connection resets, temporary network issues
- **Behavior**: Immediate retry up to max attempts
- **Configuration**: Low delay, limited attempts

#### Delayed Retry
- **Use Case**: Rate limits, server overload, network timeouts
- **Behavior**: Exponential backoff with jitter
- **Configuration**: Increasing delays, more attempts allowed

#### Rollback and Retry
- **Use Case**: Data validation errors, partial failures
- **Behavior**: Rollback transaction state, then retry
- **Configuration**: State management integration required

#### Manual Intervention
- **Use Case**: Authentication failures, critical configuration errors
- **Behavior**: Creates replay artifact, notifies operators
- **Configuration**: Detailed recovery instructions provided

### Replay Workflow Integration

When manual intervention is required, the system automatically:

1. **Creates Replay Artifact**: Contains operation context and recovery instructions
2. **Provides Recovery Actions**: Specific steps to resolve the issue
3. **Enables Resumption**: Operations can be resumed after manual fixes
4. **Tracks Resolution**: Recovery completion is logged and tracked

## Configuration

### Basic Configuration

```typescript
const config = {
  maxRecoveryTime: 300000, // 5 minutes
  enableAutoRollback: true,
  enableReplayArtifacts: true,
  enableGracefulDegradation: true
};
```

### Advanced Configuration

```typescript
const advancedConfig = {
  customStrategies: new Map([
    ['custom_retry', async (error, context) => {
      // Custom recovery logic
      return recoveryResult;
    }]
  ]),
  onRecoveryStart: (error, context) => {
    console.log(`Recovery started: ${error.message}`);
  },
  onRecoveryComplete: (result, context) => {
    console.log(`Recovery ${result.success ? 'succeeded' : 'failed'}`);
  },
  onManualInterventionRequired: (error, context) => {
    // Send notification to operators
    notifyOperators(error, context);
  }
};
```

## Integration with Existing Systems

### GitHub API Integration

The error handling system integrates seamlessly with the existing GitHub API client:

```typescript
// Enhanced API calls with automatic error recovery
const enhancedApi = new EnhancedGitHubApi(config);

const result = await coordinator.recoverFromError(
  new Error('Rate limit exceeded'),
  async () => await enhancedApi.createIssue(issueData)
);
```

### Idempotency Manager Integration

Recovery operations work with the existing idempotency framework:

```typescript
const manager = new IdempotencyManager();
manager.beginTransaction();

try {
  const result = await coordinator.recoverFromError(error, operation);
  manager.commitTransaction();
} catch (recoveryError) {
  manager.rollbackTransaction();
  throw recoveryError;
}
```

### Artifact Recovery Integration

Manual recovery operations integrate with the artifact system:

```typescript
// Failed operations create replay artifacts
const result = await coordinator.recoverFromError(error, operation);

if (result.replayArtifactId) {
  // Use existing artifact recovery system
  const artifactRecovery = new ArtifactRecovery(config);
  await artifactRecovery.recoverFromArtifact(result.replayArtifactId);
}
```

## Monitoring and Observability

### Recovery Statistics

```typescript
const stats = coordinator.getRecoveryStatistics();
console.log(`Success rate: ${stats.successfulRecoveries / stats.totalRecoveries}`);
console.log(`Most common strategy: ${stats.mostCommonStrategy}`);
console.log(`Average retry attempts: ${stats.averageRetryAttempts}`);
```

### Correlation Tracing

```typescript
const logger = getLogger();
const trace = logger.getCorrelationTrace(correlationId);

// Full operation chain with all related log entries
trace.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.message}`);
});
```

### Performance Tracking

```typescript
// Automatic performance measurement
const perfId = logger.startPerformanceMeasurement('batch_operation');
// ... perform operations
logger.endPerformanceMeasurement(perfId, { itemsProcessed: 100 });
```

## Best Practices

### Development

1. **Always Use Correlation Context**: Wrap operations in correlation tracking
2. **Classify Errors Appropriately**: Ensure error patterns match actual behavior
3. **Test Recovery Scenarios**: Verify each recovery strategy works as expected
4. **Log Recovery Actions**: Provide detailed logging for debugging

### Production

1. **Monitor Recovery Rates**: Track success/failure ratios for recovery operations
2. **Review Replay Artifacts**: Regularly process manual intervention requests
3. **Analyze Error Patterns**: Use categorization data to improve system reliability
4. **Update Recovery Strategies**: Refine strategies based on operational experience

### Debugging

1. **Use Correlation Traces**: Follow operation chains through correlation IDs
2. **Review Recovery History**: Analyze past recovery attempts for patterns
3. **Check Error Classifications**: Verify errors are categorized correctly
4. **Examine Replay Data**: Use replay artifacts to understand failure contexts

## Example: Complete Error Handling Workflow

```typescript
import { 
  CorrelationTracker,
  ErrorRecoveryCoordinator,
  getLogger,
  LogCategory
} from './scripts/error-handling';

async function createIssuesWithRecovery(issues: IssueData[]) {
  const tracker = CorrelationTracker.getInstance();
  const logger = getLogger();
  const coordinator = new ErrorRecoveryCoordinator(
    idempotencyManager,
    artifactRecovery,
    { enableReplayArtifacts: true }
  );

  return await tracker.withCorrelation('batch_issue_creation', async (context) => {
    logger.logOperationStart('batch_issue_creation', { count: issues.length });
    
    const results = [];
    
    for (const issue of issues) {
      try {
        const result = await coordinator.recoverFromError(
          new Error('Potential failure'),
          async () => {
            return await githubApi.createIssue(issue);
          },
          context
        );
        
        if (result.success) {
          results.push({ issue, success: true });
        } else {
          logger.warn('Issue creation requires manual intervention', 
            LogCategory.OPERATION, {
              issueTitle: issue.title,
              replayArtifactId: result.replayArtifactId
            });
          results.push({ issue, success: false, artifactId: result.replayArtifactId });
        }
        
      } catch (error) {
        logger.error('Issue creation failed completely', 
          LogCategory.OPERATION, error as Error, {
            issueTitle: issue.title
          });
        results.push({ issue, success: false, error });
      }
    }
    
    logger.logOperationComplete('batch_issue_creation', true, {
      totalIssues: issues.length,
      successful: results.filter(r => r.success).length,
      requiresIntervention: results.filter(r => !r.success && r.artifactId).length
    });
    
    return results;
  });
}
```

This comprehensive error handling system ensures robust operation in the face of various failure scenarios while providing detailed observability and recovery capabilities.