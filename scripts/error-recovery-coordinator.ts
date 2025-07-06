/**
 * Error Recovery Coordinator
 * 
 * Central coordinator for comprehensive error recovery workflows,
 * integrating retry logic, rollback mechanisms, and manual recovery operations.
 */

import { CorrelationTracker, CorrelationContext, formatCorrelationInfo } from './correlation-tracking';
import { 
  ErrorCategorizer, 
  ClassifiedError, 
  ErrorRecoverability, 
  RecoveryStrategy, 
  ErrorSeverity 
} from './error-categorization';
import { IdempotencyManager } from './idempotency-manager';
import { ArtifactRecovery } from './artifact-recovery';

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovery strategy that was applied */
  strategyApplied: RecoveryStrategy;
  /** Number of retry attempts made */
  retryAttempts: number;
  /** Whether rollback was performed */
  rollbackPerformed: boolean;
  /** Whether manual intervention is needed */
  manualInterventionRequired: boolean;
  /** Recovery completion time */
  completionTime: Date;
  /** Additional recovery metadata */
  metadata?: Record<string, any>;
  /** Final error if recovery failed */
  finalError?: ClassifiedError;
  /** Recovery actions taken */
  actionsTaken: string[];
  /** Replay artifact ID if created */
  replayArtifactId?: string;
}

/**
 * Recovery operation configuration
 */
export interface RecoveryConfig {
  /** Maximum total recovery time in milliseconds */
  maxRecoveryTime?: number;
  /** Whether to enable automatic rollback */
  enableAutoRollback?: boolean;
  /** Whether to create replay artifacts for manual recovery */
  enableReplayArtifacts?: boolean;
  /** Whether to enable graceful degradation */
  enableGracefulDegradation?: boolean;
  /** Custom recovery strategies */
  customStrategies?: Map<string, (error: ClassifiedError, context: CorrelationContext) => Promise<RecoveryResult>>;
  /** Recovery notification callbacks */
  onRecoveryStart?: (error: ClassifiedError, context: CorrelationContext) => void;
  onRecoveryComplete?: (result: RecoveryResult, context: CorrelationContext) => void;
  onManualInterventionRequired?: (error: ClassifiedError, context: CorrelationContext) => void;
}

/**
 * Recovery operation status
 */
export enum RecoveryStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RETRYING = 'retrying',
  ROLLING_BACK = 'rolling_back',
  SUCCESS = 'success',
  FAILED = 'failed',
  MANUAL_INTERVENTION_REQUIRED = 'manual_intervention_required'
}

/**
 * Active recovery operation tracking
 */
interface ActiveRecovery {
  correlationId: string;
  error: ClassifiedError;
  status: RecoveryStatus;
  startTime: Date;
  retryCount: number;
  maxRetries: number;
  lastAttemptTime?: Date;
  nextRetryTime?: Date;
  actionsTaken: string[];
  rollbackPerformed: boolean;
}

/**
 * Error Recovery Coordinator
 */
export class ErrorRecoveryCoordinator {
  private correlationTracker: CorrelationTracker;
  private idempotencyManager: IdempotencyManager;
  private artifactRecovery: ArtifactRecovery;
  private config: Required<RecoveryConfig>;
  private activeRecoveries: Map<string, ActiveRecovery> = new Map();
  private recoveryHistory: RecoveryResult[] = [];

  constructor(
    idempotencyManager: IdempotencyManager,
    artifactRecovery: ArtifactRecovery,
    config: RecoveryConfig = {}
  ) {
    this.correlationTracker = CorrelationTracker.getInstance();
    this.idempotencyManager = idempotencyManager;
    this.artifactRecovery = artifactRecovery;
    
    // Set default configuration
    this.config = {
      maxRecoveryTime: config.maxRecoveryTime || 300000, // 5 minutes
      enableAutoRollback: config.enableAutoRollback ?? true,
      enableReplayArtifacts: config.enableReplayArtifacts ?? true,
      enableGracefulDegradation: config.enableGracefulDegradation ?? true,
      customStrategies: config.customStrategies || new Map(),
      onRecoveryStart: config.onRecoveryStart || (() => {}),
      onRecoveryComplete: config.onRecoveryComplete || (() => {}),
      onManualInterventionRequired: config.onManualInterventionRequired || (() => {})
    };
  }

  /**
   * Coordinate comprehensive error recovery
   */
  async recoverFromError(
    error: Error,
    operation: () => Promise<any>,
    context?: CorrelationContext
  ): Promise<RecoveryResult> {
    // Start recovery correlation context
    const recoveryContext = context || this.correlationTracker.startContext('error_recovery', {
      originalError: error.message,
      operationRetry: true
    });

    const logPrefix = formatCorrelationInfo(recoveryContext);
    console.log(`${logPrefix} 🚨 Starting error recovery workflow`);

    try {
      // Classify the error
      const classifiedError = ErrorCategorizer.classifyError(error, recoveryContext);
      console.log(`${logPrefix} 📊 Error classified: ${classifiedError.classification.category} (${classifiedError.classification.recoverability})`);

      // Track active recovery
      const activeRecovery: ActiveRecovery = {
        correlationId: recoveryContext.correlationId,
        error: classifiedError,
        status: RecoveryStatus.PENDING,
        startTime: new Date(),
        retryCount: 0,
        maxRetries: classifiedError.classification.maxRetries,
        actionsTaken: [],
        rollbackPerformed: false
      };
      
      this.activeRecoveries.set(recoveryContext.correlationId, activeRecovery);
      this.config.onRecoveryStart(classifiedError, recoveryContext);

      // Execute recovery strategy
      const result = await this.executeRecoveryStrategy(
        classifiedError,
        operation,
        recoveryContext,
        activeRecovery
      );

      // Complete recovery tracking
      this.activeRecoveries.delete(recoveryContext.correlationId);
      this.recoveryHistory.push(result);
      this.config.onRecoveryComplete(result, recoveryContext);

      console.log(`${logPrefix} ✅ Recovery completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      return result;

    } catch (recoveryError) {
      console.error(`${logPrefix} ❌ Recovery workflow failed:`, recoveryError);
      
      const failedResult: RecoveryResult = {
        success: false,
        strategyApplied: RecoveryStrategy.ABORT,
        retryAttempts: 0,
        rollbackPerformed: false,
        manualInterventionRequired: true,
        completionTime: new Date(),
        finalError: ErrorCategorizer.classifyError(recoveryError as Error, recoveryContext),
        actionsTaken: ['recovery_workflow_failed']
      };

      this.activeRecoveries.delete(recoveryContext.correlationId);
      this.recoveryHistory.push(failedResult);
      return failedResult;

    } finally {
      if (!context) {
        this.correlationTracker.endContext(recoveryContext.correlationId);
      }
    }
  }

  /**
   * Execute specific recovery strategy
   */
  private async executeRecoveryStrategy(
    error: ClassifiedError,
    operation: () => Promise<any>,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    const strategy = error.classification.recoveryStrategy;
    
    console.log(`${logPrefix} 🔄 Executing recovery strategy: ${strategy}`);
    activeRecovery.status = RecoveryStatus.IN_PROGRESS;
    activeRecovery.actionsTaken.push(`strategy_selected:${strategy}`);

    // Check for custom strategy
    if (this.config.customStrategies.has(strategy)) {
      const customStrategy = this.config.customStrategies.get(strategy)!;
      return await customStrategy(error, context);
    }

    switch (strategy) {
      case RecoveryStrategy.IMMEDIATE_RETRY:
        return await this.executeImmediateRetry(error, operation, context, activeRecovery);
      
      case RecoveryStrategy.DELAYED_RETRY:
        return await this.executeDelayedRetry(error, operation, context, activeRecovery);
      
      case RecoveryStrategy.ROLLBACK_RETRY:
        return await this.executeRollbackRetry(error, operation, context, activeRecovery);
      
      case RecoveryStrategy.MANUAL_INTERVENTION:
        return await this.handleManualIntervention(error, context, activeRecovery);
      
      case RecoveryStrategy.FALLBACK:
        return await this.executeFallback(error, context, activeRecovery);
      
      case RecoveryStrategy.SKIP:
        return await this.executeSkip(error, context, activeRecovery);
      
      case RecoveryStrategy.ABORT:
        return await this.executeAbort(error, context, activeRecovery);
      
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  /**
   * Execute immediate retry strategy
   */
  private async executeImmediateRetry(
    error: ClassifiedError,
    operation: () => Promise<any>,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    activeRecovery.status = RecoveryStatus.RETRYING;
    
    while (activeRecovery.retryCount < activeRecovery.maxRetries) {
      activeRecovery.retryCount++;
      activeRecovery.lastAttemptTime = new Date();
      
      console.log(`${logPrefix} 🔁 Immediate retry attempt ${activeRecovery.retryCount}/${activeRecovery.maxRetries}`);
      
      try {
        const result = await operation();
        
        return {
          success: true,
          strategyApplied: RecoveryStrategy.IMMEDIATE_RETRY,
          retryAttempts: activeRecovery.retryCount,
          rollbackPerformed: false,
          manualInterventionRequired: false,
          completionTime: new Date(),
          actionsTaken: [...activeRecovery.actionsTaken, `retry_success:${activeRecovery.retryCount}`]
        };
        
      } catch (retryError) {
        console.log(`${logPrefix} ⚠️ Retry attempt ${activeRecovery.retryCount} failed: ${(retryError as Error).message}`);
        activeRecovery.actionsTaken.push(`retry_failed:${activeRecovery.retryCount}`);
        
        if (activeRecovery.retryCount >= activeRecovery.maxRetries) {
          return {
            success: false,
            strategyApplied: RecoveryStrategy.IMMEDIATE_RETRY,
            retryAttempts: activeRecovery.retryCount,
            rollbackPerformed: false,
            manualInterventionRequired: true,
            completionTime: new Date(),
            finalError: ErrorCategorizer.classifyError(retryError as Error, context),
            actionsTaken: [...activeRecovery.actionsTaken, 'max_retries_exceeded']
          };
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      strategyApplied: RecoveryStrategy.IMMEDIATE_RETRY,
      retryAttempts: activeRecovery.retryCount,
      rollbackPerformed: false,
      manualInterventionRequired: true,
      completionTime: new Date(),
      actionsTaken: [...activeRecovery.actionsTaken, 'unexpected_exit']
    };
  }

  /**
   * Execute delayed retry strategy with exponential backoff
   */
  private async executeDelayedRetry(
    error: ClassifiedError,
    operation: () => Promise<any>,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    activeRecovery.status = RecoveryStatus.RETRYING;
    
    while (activeRecovery.retryCount < activeRecovery.maxRetries) {
      activeRecovery.retryCount++;
      
      // Calculate exponential backoff delay
      const baseDelay = error.classification.retryDelay;
      const delay = baseDelay * Math.pow(2, activeRecovery.retryCount - 1);
      const jitteredDelay = delay + Math.random() * 1000; // Add jitter
      
      activeRecovery.nextRetryTime = new Date(Date.now() + jitteredDelay);
      
      console.log(`${logPrefix} ⏳ Waiting ${Math.round(jitteredDelay)}ms before retry ${activeRecovery.retryCount}/${activeRecovery.maxRetries}`);
      await this.sleep(jitteredDelay);
      
      activeRecovery.lastAttemptTime = new Date();
      console.log(`${logPrefix} 🔁 Delayed retry attempt ${activeRecovery.retryCount}/${activeRecovery.maxRetries}`);
      
      try {
        const result = await operation();
        
        return {
          success: true,
          strategyApplied: RecoveryStrategy.DELAYED_RETRY,
          retryAttempts: activeRecovery.retryCount,
          rollbackPerformed: false,
          manualInterventionRequired: false,
          completionTime: new Date(),
          actionsTaken: [...activeRecovery.actionsTaken, `delayed_retry_success:${activeRecovery.retryCount}`]
        };
        
      } catch (retryError) {
        console.log(`${logPrefix} ⚠️ Delayed retry attempt ${activeRecovery.retryCount} failed: ${(retryError as Error).message}`);
        activeRecovery.actionsTaken.push(`delayed_retry_failed:${activeRecovery.retryCount}`);
        
        if (activeRecovery.retryCount >= activeRecovery.maxRetries) {
          return {
            success: false,
            strategyApplied: RecoveryStrategy.DELAYED_RETRY,
            retryAttempts: activeRecovery.retryCount,
            rollbackPerformed: false,
            manualInterventionRequired: true,
            completionTime: new Date(),
            finalError: ErrorCategorizer.classifyError(retryError as Error, context),
            actionsTaken: [...activeRecovery.actionsTaken, 'max_delayed_retries_exceeded']
          };
        }
      }
    }

    return {
      success: false,
      strategyApplied: RecoveryStrategy.DELAYED_RETRY,
      retryAttempts: activeRecovery.retryCount,
      rollbackPerformed: false,
      manualInterventionRequired: true,
      completionTime: new Date(),
      actionsTaken: [...activeRecovery.actionsTaken, 'delayed_retry_unexpected_exit']
    };
  }

  /**
   * Execute rollback and retry strategy
   */
  private async executeRollbackRetry(
    error: ClassifiedError,
    operation: () => Promise<any>,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    activeRecovery.status = RecoveryStatus.ROLLING_BACK;
    
    console.log(`${logPrefix} ⮪ Executing rollback before retry`);
    
    try {
      // Perform rollback
      this.idempotencyManager.rollbackTransaction();
      activeRecovery.rollbackPerformed = true;
      activeRecovery.actionsTaken.push('rollback_completed');
      
      console.log(`${logPrefix} ✅ Rollback completed, proceeding with retry`);
      
      // Now attempt retry with fresh state
      return await this.executeDelayedRetry(error, operation, context, activeRecovery);
      
    } catch (rollbackError) {
      console.error(`${logPrefix} ❌ Rollback failed:`, rollbackError);
      
      return {
        success: false,
        strategyApplied: RecoveryStrategy.ROLLBACK_RETRY,
        retryAttempts: 0,
        rollbackPerformed: false,
        manualInterventionRequired: true,
        completionTime: new Date(),
        finalError: ErrorCategorizer.classifyError(rollbackError as Error, context),
        actionsTaken: [...activeRecovery.actionsTaken, 'rollback_failed']
      };
    }
  }

  /**
   * Handle manual intervention requirement
   */
  private async handleManualIntervention(
    error: ClassifiedError,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    activeRecovery.status = RecoveryStatus.MANUAL_INTERVENTION_REQUIRED;
    
    console.log(`${logPrefix} 🛠️ Manual intervention required for error recovery`);
    
    let replayArtifactId: string | undefined;
    
    // Create replay artifact if enabled
    if (this.config.enableReplayArtifacts) {
      try {
        console.log(`${logPrefix} 📦 Creating replay artifact for manual recovery`);
        
        // Extract operation context for replay
        const replayData = {
          correlationId: context.correlationId,
          operationType: context.operationType,
          error: {
            message: error.message,
            classification: error.classification,
            timestamp: error.timestamp
          },
          suggestedActions: error.classification.suggestedActions,
          recoveryInstructions: this.generateRecoveryInstructions(error)
        };
        
        // In a real implementation, this would upload to artifact storage
        console.log(`${logPrefix} 📄 Replay data prepared:`, JSON.stringify(replayData, null, 2));
        replayArtifactId = `replay_${context.correlationId}`;
        activeRecovery.actionsTaken.push(`replay_artifact_created:${replayArtifactId}`);
        
      } catch (artifactError) {
        console.error(`${logPrefix} ⚠️ Failed to create replay artifact:`, artifactError);
        activeRecovery.actionsTaken.push('replay_artifact_failed');
      }
    }
    
    // Notify callback
    this.config.onManualInterventionRequired(error, context);
    
    return {
      success: false,
      strategyApplied: RecoveryStrategy.MANUAL_INTERVENTION,
      retryAttempts: 0,
      rollbackPerformed: false,
      manualInterventionRequired: true,
      completionTime: new Date(),
      finalError: error,
      actionsTaken: [...activeRecovery.actionsTaken, 'manual_intervention_required'],
      replayArtifactId,
      metadata: {
        suggestedActions: error.classification.suggestedActions,
        errorCategory: error.classification.category,
        recoverability: error.classification.recoverability
      }
    };
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback(
    error: ClassifiedError,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    
    console.log(`${logPrefix} 🔄 Executing fallback strategy (graceful degradation)`);
    
    // For now, fallback means marking as partially successful
    // In a real implementation, this would execute alternative logic
    
    return {
      success: true,
      strategyApplied: RecoveryStrategy.FALLBACK,
      retryAttempts: 0,
      rollbackPerformed: false,
      manualInterventionRequired: false,
      completionTime: new Date(),
      actionsTaken: [...activeRecovery.actionsTaken, 'fallback_executed'],
      metadata: {
        degradedMode: true,
        originalError: error.message
      }
    };
  }

  /**
   * Execute skip strategy
   */
  private async executeSkip(
    error: ClassifiedError,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    
    console.log(`${logPrefix} ⏭️ Skipping operation due to error: ${error.message}`);
    
    return {
      success: true,
      strategyApplied: RecoveryStrategy.SKIP,
      retryAttempts: 0,
      rollbackPerformed: false,
      manualInterventionRequired: false,
      completionTime: new Date(),
      actionsTaken: [...activeRecovery.actionsTaken, 'operation_skipped'],
      metadata: {
        skipped: true,
        reason: error.classification.description
      }
    };
  }

  /**
   * Execute abort strategy
   */
  private async executeAbort(
    error: ClassifiedError,
    context: CorrelationContext,
    activeRecovery: ActiveRecovery
  ): Promise<RecoveryResult> {
    const logPrefix = formatCorrelationInfo(context);
    
    console.log(`${logPrefix} 🛑 Aborting operation due to critical error: ${error.message}`);
    
    // Perform rollback if enabled
    let rollbackPerformed = false;
    if (this.config.enableAutoRollback && error.classification.shouldRollback) {
      try {
        this.idempotencyManager.rollbackTransaction();
        rollbackPerformed = true;
        activeRecovery.actionsTaken.push('abort_rollback_completed');
      } catch (rollbackError) {
        console.error(`${logPrefix} ❌ Rollback during abort failed:`, rollbackError);
        activeRecovery.actionsTaken.push('abort_rollback_failed');
      }
    }
    
    return {
      success: false,
      strategyApplied: RecoveryStrategy.ABORT,
      retryAttempts: 0,
      rollbackPerformed,
      manualInterventionRequired: true,
      completionTime: new Date(),
      finalError: error,
      actionsTaken: [...activeRecovery.actionsTaken, 'operation_aborted']
    };
  }

  /**
   * Generate recovery instructions for manual intervention
   */
  private generateRecoveryInstructions(error: ClassifiedError): string[] {
    const instructions = [
      `Error Category: ${error.classification.category}`,
      `Recoverability: ${error.classification.recoverability}`,
      `Severity: ${error.classification.severity}`,
      '',
      'Suggested Actions:'
    ];
    
    error.classification.suggestedActions.forEach((action, index) => {
      instructions.push(`${index + 1}. ${action}`);
    });
    
    instructions.push('');
    instructions.push('Recovery Options:');
    
    if (error.classification.retryable) {
      instructions.push('- Retry operation after addressing the underlying issue');
    }
    
    if (error.classification.shouldRollback) {
      instructions.push('- Rollback any partial changes before retrying');
    }
    
    if (error.classification.recoverability === ErrorRecoverability.PERMANENT) {
      instructions.push('- Review and correct the input data or configuration');
    }
    
    return instructions;
  }

  /**
   * Get active recovery status
   */
  getActiveRecoveries(): Map<string, ActiveRecovery> {
    return new Map(this.activeRecoveries);
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit?: number): RecoveryResult[] {
    return limit ? this.recoveryHistory.slice(-limit) : [...this.recoveryHistory];
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    manualInterventionsRequired: number;
    averageRetryAttempts: number;
    mostCommonStrategy: RecoveryStrategy;
    strategyCounts: Record<RecoveryStrategy, number>;
  } {
    const strategyCounts = {} as Record<RecoveryStrategy, number>;
    let totalRetryAttempts = 0;
    let successfulRecoveries = 0;
    let manualInterventionsRequired = 0;

    for (const result of this.recoveryHistory) {
      strategyCounts[result.strategyApplied] = (strategyCounts[result.strategyApplied] || 0) + 1;
      totalRetryAttempts += result.retryAttempts;
      
      if (result.success) {
        successfulRecoveries++;
      }
      
      if (result.manualInterventionRequired) {
        manualInterventionsRequired++;
      }
    }

    const mostCommonStrategy = Object.entries(strategyCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] as RecoveryStrategy || RecoveryStrategy.MANUAL_INTERVENTION;

    return {
      totalRecoveries: this.recoveryHistory.length,
      successfulRecoveries,
      failedRecoveries: this.recoveryHistory.length - successfulRecoveries,
      manualInterventionsRequired,
      averageRetryAttempts: this.recoveryHistory.length > 0 ? totalRetryAttempts / this.recoveryHistory.length : 0,
      mostCommonStrategy,
      strategyCounts
    };
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear old recovery history
   */
  clearRecoveryHistory(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.recoveryHistory = this.recoveryHistory.filter(
      result => result.completionTime > cutoffTime
    );
  }
}