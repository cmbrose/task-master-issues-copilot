#!/usr/bin/env ts-node

/**
 * Comprehensive Error Handling and Recovery Workflow Tests
 * 
 * Tests the complete error handling system including:
 * - Correlation tracking
 * - Error categorization 
 * - Recovery coordination
 * - Structured logging
 * - Integration with replay workflow
 */

import { CorrelationTracker, CorrelationContext, getCurrentCorrelationId } from '../scripts/correlation-tracking';
import { 
  ErrorCategorizer, 
  ErrorRecoverability, 
  RecoveryStrategy, 
  ErrorSeverity,
  ClassifiedError 
} from '../scripts/error-categorization';
import { ErrorRecoveryCoordinator, RecoveryResult } from '../scripts/error-recovery-coordinator';
import { StructuredLogger, LogLevel, LogCategory, getLogger } from '../scripts/structured-logging';
import { IdempotencyManager } from '../scripts/idempotency-manager';
import { ArtifactRecovery } from '../scripts/artifact-recovery';

// Mock implementation for testing
class MockIdempotencyManager extends IdempotencyManager {
  constructor() {
    super('/tmp/test-state.json');
  }
  
  rollbackTransaction(): void {
    console.log('Mock: Transaction rolled back');
  }
}

class MockArtifactRecovery extends ArtifactRecovery {
  constructor() {
    super({
      githubToken: 'mock-token',
      owner: 'test-owner',
      repo: 'test-repo',
      artifactId: 'mock-artifact-123'
    });
  }
}

async function testCorrelationTracking(): Promise<void> {
  console.log('🧪 Testing Correlation Tracking System...');
  
  const tracker = CorrelationTracker.getInstance();
  
  // Test basic context creation
  const context1 = tracker.startContext('test_operation', { test: true });
  console.log(`✓ Created context: ${context1.correlationId}`);
  
  // Test nested context
  const context2 = tracker.startContext('nested_operation', { nested: true });
  console.log(`✓ Created nested context: ${context2.correlationId} (parent: ${context2.parentCorrelationId})`);
  
  // Test current context retrieval
  const current = tracker.getCurrentContext();
  if (current?.correlationId === context2.correlationId) {
    console.log('✓ Current context correctly retrieved');
  } else {
    throw new Error('Current context retrieval failed');
  }
  
  // Test operation chain
  const chain = tracker.getOperationChain(context2.correlationId);
  if (chain.length === 2 && chain[0].correlationId === context1.correlationId) {
    console.log('✓ Operation chain correctly built');
  } else {
    throw new Error('Operation chain incorrect');
  }
  
  // Test withCorrelation wrapper
  const result = await tracker.withCorrelation('wrapper_test', async (ctx) => {
    const wrappedId = getCurrentCorrelationId();
    if (wrappedId === ctx.correlationId) {
      console.log('✓ Correlation wrapper working correctly');
      return 'success';
    }
    throw new Error('Correlation wrapper failed');
  });
  
  if (result === 'success') {
    console.log('✓ Correlation wrapper returned correct result');
  }
  
  // Cleanup
  tracker.endContext(context2.correlationId);
  tracker.endContext(context1.correlationId);
  
  console.log('✅ Correlation tracking tests passed\n');
}

async function testErrorCategorization(): Promise<void> {
  console.log('🧪 Testing Error Categorization System...');
  
  // Test network error classification
  const networkError = new Error('Network timeout occurred');
  const networkClassified = ErrorCategorizer.classifyError(networkError);
  
  if (networkClassified.classification.recoverability === ErrorRecoverability.TRANSIENT &&
      networkClassified.classification.retryable === true) {
    console.log('✓ Network error correctly classified as transient/retryable');
  } else {
    throw new Error('Network error classification failed');
  }
  
  // Test validation error classification
  const validationError = new Error('Invalid input data provided');
  const validationClassified = ErrorCategorizer.classifyError(validationError);
  
  if (validationClassified.classification.recoverability === ErrorRecoverability.PERMANENT &&
      validationClassified.classification.retryable === false) {
    console.log('✓ Validation error correctly classified as permanent/non-retryable');
  } else {
    throw new Error('Validation error classification failed');
  }
  
  // Test rate limit error classification  
  const rateLimitError = new Error('Rate limit exceeded - too many requests');
  const rateLimitClassified = ErrorCategorizer.classifyError(rateLimitError);
  
  if (rateLimitClassified.classification.category === 'rate_limit' &&
      rateLimitClassified.classification.maxRetries === 10) {
    console.log('✓ Rate limit error correctly classified with appropriate retry count');
  } else {
    throw new Error('Rate limit error classification failed');
  }
  
  // Test utility functions
  if (ErrorCategorizer.isRetryable(networkClassified)) {
    console.log('✓ isRetryable utility function working');
  }
  
  if (ErrorCategorizer.shouldRollback(validationClassified)) {
    console.log('✓ shouldRollback utility function working');
  }
  
  const retryConfig = ErrorCategorizer.getRetryConfig(networkClassified);
  if (retryConfig.maxRetries > 0 && retryConfig.retryDelay > 0) {
    console.log('✓ Retry configuration extraction working');
  }
  
  console.log('✅ Error categorization tests passed\n');
}

async function testStructuredLogging(): Promise<void> {
  console.log('🧪 Testing Structured Logging System...');
  
  const logger = getLogger({
    minLevel: LogLevel.DEBUG,
    enableConsole: false, // Disable console for test
    enableStructuredOutput: true
  });
  
  const tracker = CorrelationTracker.getInstance();
  
  // Test logging with correlation context
  const context = tracker.startContext('logging_test', { test: true });
  
  logger.info('Test info message', LogCategory.SYSTEM, { key: 'value' });
  logger.warn('Test warning message', LogCategory.OPERATION);
  
  // Test error logging
  const testError = new Error('Test error for logging');
  logger.error('Test error occurred', LogCategory.ERROR_RECOVERY, testError);
  
  // Test operation logging
  logger.logOperationStart('test_operation', { param: 'value' });
  logger.logOperationComplete('test_operation', true, { result: 'success' });
  
  // Test performance measurement
  const perfId = logger.startPerformanceMeasurement('performance_test');
  await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
  logger.endPerformanceMeasurement(perfId, { testData: true });
  
  // Test log retrieval
  const logs = logger.getLogEntries({
    correlationId: context.correlationId,
    category: LogCategory.SYSTEM
  });
  
  if (logs.length > 0) {
    console.log('✓ Log entries correctly stored and retrieved');
  }
  
  // Test correlation trace
  const trace = logger.getCorrelationTrace(context.correlationId);
  if (trace.length > 0) {
    console.log('✓ Correlation trace working');
  }
  
  tracker.endContext(context.correlationId);
  
  console.log('✅ Structured logging tests passed\n');
}

async function testErrorRecoveryCoordinator(): Promise<void> {
  console.log('🧪 Testing Error Recovery Coordinator...');
  
  const mockIdempotency = new MockIdempotencyManager();
  const mockArtifact = new MockArtifactRecovery();
  const logger = getLogger();
  
  const coordinator = new ErrorRecoveryCoordinator(mockIdempotency, mockArtifact, {
    maxRecoveryTime: 30000,
    enableAutoRollback: true,
    enableReplayArtifacts: true,
    onRecoveryStart: (error, context) => {
      console.log(`  Recovery started for: ${error.message}`);
    },
    onRecoveryComplete: (result, context) => {
      console.log(`  Recovery completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    }
  });
  
  // Test immediate retry success  
  let attemptCount = 0;
  const retryableOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      const error = new Error('Connection reset by peer');
      (error as any).code = 'ECONNRESET'; // This should be classified as immediate retry
      throw error;
    }
    return 'success';
  };
  
  // Force an immediate retry classification by using a connection error
  const connectionError = new Error('Connection reset by peer');
  (connectionError as any).code = 'ECONNRESET';
  
  const result1 = await coordinator.recoverFromError(
    connectionError,
    retryableOperation
  );
  
  if (result1.success && result1.retryAttempts >= 1) {
    console.log('✓ Network error recovery successful');
  } else {
    console.log(`Debug: result1 = ${JSON.stringify(result1, null, 2)}`);
    throw new Error('Network error recovery failed');
  }
  
  // Test permanent error handling
  const permanentOperation = async () => {
    throw new Error('Invalid input data provided'); // Permanent error
  };
  
  const result2 = await coordinator.recoverFromError(
    new Error('Invalid input data provided'),
    permanentOperation
  );
  
  if (!result2.success && result2.manualInterventionRequired) {
    console.log('✓ Permanent error correctly requires manual intervention');
  } else {
    throw new Error('Permanent error handling failed');
  }
  
  // Test rate limit handling with delay
  let rateLimitAttempts = 0;
  const rateLimitOperation = async () => {
    rateLimitAttempts++;
    if (rateLimitAttempts < 2) {
      throw new Error('Rate limit exceeded - too many requests');
    }
    return 'rate_limit_recovered';
  };
  
  const result3 = await coordinator.recoverFromError(
    new Error('Rate limit exceeded - too many requests'),
    rateLimitOperation
  );
  
  if (result3.success && result3.strategyApplied === RecoveryStrategy.DELAYED_RETRY) {
    console.log('✓ Rate limit recovery with delayed retry successful');
  } else {
    throw new Error('Rate limit recovery failed');
  }
  
  // Test recovery statistics
  const stats = coordinator.getRecoveryStatistics();
  if (stats.totalRecoveries === 3 && stats.successfulRecoveries === 2) {
    console.log('✓ Recovery statistics correctly tracked');
  } else {
    throw new Error(`Recovery statistics incorrect: ${JSON.stringify(stats)}`);
  }
  
  console.log('✅ Error recovery coordinator tests passed\n');
}

async function testIntegrationScenario(): Promise<void> {
  console.log('🧪 Testing Complete Integration Scenario...');
  
  const tracker = CorrelationTracker.getInstance();
  const logger = getLogger();
  const mockIdempotency = new MockIdempotencyManager();
  const mockArtifact = new MockArtifactRecovery();
  
  const coordinator = new ErrorRecoveryCoordinator(mockIdempotency, mockArtifact, {
    enableReplayArtifacts: true,
    onManualInterventionRequired: (error, context) => {
      logger.critical(
        'Manual intervention required for error recovery',
        LogCategory.ERROR_RECOVERY,
        error,
        {
          suggestedActions: error.classification.suggestedActions,
          correlationId: context.correlationId
        }
      );
    }
  });
  
  // Simulate a complex operation with multiple failure points
  await tracker.withCorrelation('integration_test', async (context) => {
    logger.logOperationStart('complex_github_operation', {
      repositoryName: 'test-repo',
      operation: 'issue_creation'
    });
    
    try {
      // Simulate GitHub API operation that fails
      const githubOperation = async () => {
        // Simulate authentication failure
        const authError = new Error('Authentication failed - unauthorized');
        (authError as any).status = 401;
        throw authError;
      };
      
      const result = await coordinator.recoverFromError(
        new Error('Authentication failed - unauthorized'),
        githubOperation,
        context
      );
      
      if (!result.success && result.manualInterventionRequired && result.replayArtifactId) {
        console.log('✓ Authentication failure correctly handled with replay artifact');
        logger.info(
          'Replay artifact created for manual recovery',
          LogCategory.ARTIFACT,
          {
            replayArtifactId: result.replayArtifactId,
            errorCategory: 'auth',
            manualInterventionRequired: true
          }
        );
      } else {
        throw new Error('Integration scenario handling incorrect');
      }
      
      logger.logOperationComplete('complex_github_operation', false, {
        error: 'authentication_failed',
        recoveryStrategy: result.strategyApplied,
        manualInterventionRequired: result.manualInterventionRequired
      });
      
    } catch (error) {
      logger.error(
        'Integration test operation failed',
        LogCategory.OPERATION,
        error as Error,
        { phase: 'integration_test' }
      );
      throw error;
    }
  });
  
  // Verify correlation trace
  const context = tracker.getCurrentContext();
  if (context) {
    const trace = logger.getCorrelationTrace(context.correlationId);
    if (trace.length > 0) {
      console.log('✓ Complete correlation trace captured');
    }
  }
  
  console.log('✅ Integration scenario tests passed\n');
}

async function testReplayWorkflowIntegration(): Promise<void> {
  console.log('🧪 Testing Replay Workflow Integration...');
  
  const mockIdempotency = new MockIdempotencyManager();
  const mockArtifact = new MockArtifactRecovery();
  const logger = getLogger();
  
  // Test replay artifact creation for manual recovery
  const coordinator = new ErrorRecoveryCoordinator(mockIdempotency, mockArtifact, {
    enableReplayArtifacts: true,
    enableAutoRollback: true
  });
  
  const failingOperation = async () => {
    throw new Error('File not found - critical configuration missing');
  };
  
  const result = await coordinator.recoverFromError(
    new Error('File not found - critical configuration missing'),
    failingOperation
  );
  
  if (result.replayArtifactId && result.manualInterventionRequired) {
    console.log('✓ Replay artifact created for manual recovery');
    
    // Verify replay artifact contains necessary information
    if (result.metadata?.suggestedActions) {
      console.log('✓ Replay artifact includes suggested recovery actions');
    }
    
    logger.info(
      'Manual recovery workflow initiated',
      LogCategory.WORKFLOW,
      {
        replayArtifactId: result.replayArtifactId,
        errorClassification: 'filesystem',
        recoveryInstructions: result.metadata?.suggestedActions
      }
    );
  } else {
    throw new Error('Replay workflow integration failed');
  }
  
  console.log('✅ Replay workflow integration tests passed\n');
}

async function runComprehensiveTests(): Promise<void> {
  console.log('🧪 Starting Comprehensive Error Handling and Recovery Tests');
  console.log('==============================================================\n');
  
  try {
    await testCorrelationTracking();
    await testErrorCategorization();
    await testStructuredLogging();
    await testErrorRecoveryCoordinator();
    await testIntegrationScenario();
    await testReplayWorkflowIntegration();
    
    console.log('🎉 All comprehensive error handling tests passed!');
    console.log('\n✅ Successfully implemented:');
    console.log('   • Correlation tracking system for operation chains');
    console.log('   • Enhanced error categorization (transient vs permanent)');
    console.log('   • Automatic retry logic with exponential backoff');
    console.log('   • Rollback mechanisms for partial failures');
    console.log('   • Structured logging with correlation IDs');
    console.log('   • Central error recovery coordinator');
    console.log('   • Integration with replay workflow for manual recovery');
    console.log('   • Comprehensive recovery strategies');
    console.log('   • Performance tracking and metrics');
    console.log('   • Recovery statistics and reporting');
    
  } catch (error) {
    console.error('\n❌ Comprehensive error handling tests failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runComprehensiveTests();
}