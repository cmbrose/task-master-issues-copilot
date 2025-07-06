# Idempotency Framework with State Tracking

## Overview

The Idempotency Framework provides comprehensive state management to ensure that operations are safely repeatable and consistent. It tracks processed PRDs, generated issues, dependency relationships, and provides transaction-like operations with rollback capabilities.

## Features

### 🔍 State Tracking
- **PRD Processing**: Tracks content hashes, file paths, and processing status
- **Issue Management**: Records issue creation, updates, and metadata
- **Dependency Chains**: Maintains relationships between tasks and issues
- **Processing History**: Complete audit trail of all operations

### 🔐 Content Hashing
- **PRD Change Detection**: SHA-256 based content and path hashing
- **Issue Body Tracking**: Efficient change detection for issue updates
- **Integrity Validation**: Prevents duplicate processing of unchanged content

### 🔄 Transaction Operations
- **Atomic Operations**: All-or-nothing transaction semantics
- **Rollback Support**: Automatic rollback on failures
- **Progress Tracking**: Checkpointing for long-running operations
- **Recovery**: Resume from last successful checkpoint

### 🔁 Replay Safety
- **Idempotent Operations**: Safe to replay without side effects
- **State Consistency**: Maintains data integrity across operations
- **Duplicate Prevention**: Prevents re-creation of existing resources

## Architecture

### Core Components

#### IdempotencyManager
Main class that orchestrates state tracking and transaction management.

```typescript
const manager = new IdempotencyManager();

// Check if PRD has been processed
const state = manager.checkPrdState(content, filePath);

// Start transaction
const txId = manager.beginTransaction();

// Record operations
manager.recordPrdProcessingStart(content, filePath);
manager.recordIssueCreation(issueNumber, taskId, sourceHash, body, labels);

// Commit or rollback
manager.commitTransaction(); // or manager.rollbackTransaction();
```

#### State Interfaces

**PrdState**: Tracks processed PRD files
```typescript
interface PrdState {
  contentHash: string;
  filePath: string;
  lastProcessed: Date;
  generatedIssues: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

**IssueState**: Tracks generated GitHub issues
```typescript
interface IssueState {
  issueNumber: number;
  taskId: string;
  sourceHash: string;
  dependencies: string[];
  dependents: string[];
  state: 'open' | 'closed';
  labels: string[];
  bodyHash: string;
}
```

**Transaction**: Manages atomic operations
```typescript
interface Transaction {
  id: string;
  operations: TransactionOperation[];
  status: 'active' | 'committed' | 'rolled_back';
  startTime: Date;
}
```

## Usage Examples

### Basic Usage

```typescript
import { IdempotencyManager } from './scripts/idempotency-manager';

const manager = new IdempotencyManager();

// Check if processing is needed
const prdContent = fs.readFileSync('docs/features.prd.md', 'utf8');
const state = manager.checkPrdState(prdContent, 'docs/features.prd.md');

if (state.isProcessed && !state.hasChanged) {
  console.log('Already processed, skipping...');
  return;
}

// Start transaction
const txId = manager.beginTransaction();

try {
  // Record processing start
  const hash = manager.recordPrdProcessingStart(prdContent, 'docs/features.prd.md');
  
  // Create issues with tracking
  manager.recordIssueCreation(101, 'task-1', hash, issueBody, ['feature']);
  manager.recordIssueCreation(102, 'task-2', hash, issueBody, ['bug'], ['task-1']);
  
  // Record completion
  manager.recordPrdProcessingComplete(hash, [101, 102]);
  
  // Commit transaction
  manager.commitTransaction();
  
} catch (error) {
  // Rollback on failure
  manager.recordPrdProcessingFailure(hash, error.message);
  manager.rollbackTransaction();
  throw error;
}
```

### Integration with Create Issues

The framework is integrated into the main `create-issues.ts` workflow:

```typescript
async function main() {
  const idempotencyManager = new IdempotencyManager();
  
  // Check if already processed
  const prdState = idempotencyManager.checkPrdState(taskGraphContent, TASKS_PATH);
  
  if (prdState.isProcessed && !prdState.hasChanged) {
    console.log('✅ Already processed, skipping...');
    return;
  }
  
  // Start transaction
  const transactionId = idempotencyManager.beginTransaction();
  
  try {
    // Process with state tracking
    const contentHash = idempotencyManager.recordPrdProcessingStart(taskGraphContent, TASKS_PATH);
    
    // Create issues with tracking
    for (const task of tasks) {
      const issue = await createOrGetIssue(task);
      idempotencyManager.recordIssueCreation(
        issue.number, 
        String(task.id), 
        contentHash, 
        issue.body, 
        issue.labels
      );
    }
    
    // Complete successfully
    idempotencyManager.recordPrdProcessingComplete(contentHash, createdIssues);
    idempotencyManager.commitTransaction();
    
  } catch (error) {
    // Rollback on failure
    idempotencyManager.recordPrdProcessingFailure(contentHash, error.message);
    idempotencyManager.rollbackTransaction();
    throw error;
  }
}
```

## State Management

### State File Location
By default, state is stored in `.taskmaster/idempotency-state.json`. This can be customized:

```typescript
const manager = new IdempotencyManager('/custom/path/to/state.json');
```

### State Cleanup
Old transactions are automatically cleaned up:

```typescript
// Clean transactions older than 24 hours (default)
manager.cleanupOldTransactions();

// Custom cleanup interval (1 hour)
manager.cleanupOldTransactions(60 * 60 * 1000);
```

### State Export/Import
For backup and debugging:

```typescript
// Export current state
const backup = manager.exportState();

// Import state from backup
manager.importState(backup);
```

## Testing

Run the comprehensive test suite:

```bash
npm run test:idempotency-framework
```

The tests cover:
- ✅ PRD state tracking and change detection
- ✅ Content hashing consistency and sensitivity
- ✅ Transaction operations and rollback
- ✅ Replay safety mechanisms
- ✅ Dependency tracking accuracy
- ✅ State management operations

## Performance Characteristics

### Efficiency Features
- **Lightweight Hashing**: Fast SHA-256 based content detection
- **Minimal Storage**: Efficient JSON-based state persistence
- **Transaction Batching**: Multiple operations in single transaction
- **Lazy Loading**: State loaded only when needed

### Scalability
- **Large PRDs**: Handles 500+ task processing efficiently
- **Complex Dependencies**: Supports deep dependency chains
- **Concurrent Operations**: Thread-safe state management
- **Memory Efficient**: Minimal memory footprint

## Error Handling

### Automatic Recovery
- **Transaction Rollback**: Automatic rollback on failures
- **State Validation**: Integrity checks on state loading
- **Graceful Degradation**: Continues operation even with state issues

### Error States
- **Failed Processing**: Tracks failed PRD processing attempts
- **Partial Completion**: Handles incomplete operations
- **State Corruption**: Rebuilds state from artifacts when possible

## Integration Points

### GitHub API Integration
- Works seamlessly with existing GitHub API client
- Records all issue creation and update operations
- Maintains consistency with GitHub state

### Artifact Manager Integration
- Leverages existing artifact storage capabilities
- Provides backup and recovery mechanisms
- Supports metadata-based search and filtering

### Workflow Integration
- Integrates with existing GitHub Actions workflows
- Provides status reporting and metrics
- Supports webhook and scheduled execution modes

## Future Enhancements

### Planned Features
1. **Cross-Repository State**: Track state across multiple repositories
2. **Advanced Metrics**: Performance analytics and reporting
3. **State Migration**: Automatic state schema upgrades
4. **Distributed State**: Support for distributed state management
5. **Real-time Monitoring**: Live state monitoring dashboard

### Configuration Options
- **Retention Policies**: Configurable state retention
- **Backup Strategies**: Automated state backup
- **Validation Rules**: Custom state validation
- **Notification**: State change notifications

## Best Practices

### Development
1. **Always Use Transactions**: Wrap operations in transactions
2. **Check Replay Safety**: Verify operations are idempotent
3. **Handle Errors**: Implement proper error handling and rollback
4. **Monitor State**: Regular state health checks

### Production
1. **Backup State**: Regular state file backups
2. **Monitor Performance**: Track processing metrics
3. **Clean Old Data**: Regular cleanup of old transactions
4. **Validate Integrity**: Periodic state validation

### Debugging
1. **Export State**: Use state export for debugging
2. **Transaction Logs**: Review transaction history
3. **State Summary**: Monitor state statistics
4. **Replay Operations**: Use replay safety for debugging

This framework ensures that all operations are safely repeatable, maintaining consistency and preventing duplicate work while providing comprehensive audit trails and recovery capabilities.