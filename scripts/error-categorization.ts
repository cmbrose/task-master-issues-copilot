/**
 * Enhanced Error Categorization System
 * 
 * Provides comprehensive error categorization to distinguish between
 * transient and permanent errors for appropriate recovery strategies.
 */

import { CorrelationContext, createCorrelatedError } from './correlation-tracking';

/**
 * Error recoverability classification
 */
export enum ErrorRecoverability {
  /** Error can be recovered with retry */
  TRANSIENT = 'transient',
  /** Error requires intervention but may be recoverable */
  RECOVERABLE = 'recoverable',
  /** Error cannot be recovered automatically */
  PERMANENT = 'permanent',
  /** Error recoverability is unknown */
  UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low impact, operation can continue */
  LOW = 'low',
  /** Medium impact, degraded functionality */
  MEDIUM = 'medium',
  /** High impact, operation failure */
  HIGH = 'high',
  /** Critical impact, system failure */
  CRITICAL = 'critical'
}

/**
 * Error recovery strategy types
 */
export enum RecoveryStrategy {
  /** Immediate retry with backoff */
  IMMEDIATE_RETRY = 'immediate_retry',
  /** Delayed retry with exponential backoff */
  DELAYED_RETRY = 'delayed_retry',
  /** Rollback and retry */
  ROLLBACK_RETRY = 'rollback_retry',
  /** Manual intervention required */
  MANUAL_INTERVENTION = 'manual_intervention',
  /** Use fallback/degraded mode */
  FALLBACK = 'fallback',
  /** Skip operation and continue */
  SKIP = 'skip',
  /** Abort entire operation */
  ABORT = 'abort'
}

/**
 * Comprehensive error classification
 */
export interface ErrorClassification {
  /** Error recoverability */
  recoverability: ErrorRecoverability;
  /** Error severity */
  severity: ErrorSeverity;
  /** Recommended recovery strategy */
  recoveryStrategy: RecoveryStrategy;
  /** Whether retry is recommended */
  retryable: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for retries in milliseconds */
  retryDelay: number;
  /** Whether rollback is recommended */
  shouldRollback: boolean;
  /** Whether manual intervention is needed */
  requiresManualIntervention: boolean;
  /** Error category for grouping */
  category: string;
  /** Human-readable description */
  description: string;
  /** Suggested actions for recovery */
  suggestedActions: string[];
}

/**
 * Enhanced error with full classification
 */
export interface ClassifiedError extends Error {
  classification: ErrorClassification;
  correlationId?: string;
  parentCorrelationId?: string;
  operationType?: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: Date;
  retryCount?: number;
}

/**
 * Error classification patterns
 */
interface ErrorPattern {
  /** Pattern to match error messages */
  messagePattern: RegExp;
  /** HTTP status codes to match */
  statusCodes?: number[];
  /** Error types to match */
  errorTypes?: string[];
  /** Classification for this pattern */
  classification: ErrorClassification;
}

/**
 * Enhanced error categorization service
 */
export class ErrorCategorizer {
  private static readonly ERROR_PATTERNS: ErrorPattern[] = [
    // Connection errors (immediate retry)
    {
      messagePattern: /(connection reset|connection refused|econnreset|econnrefused)/i,
      errorTypes: ['ECONNRESET', 'ECONNREFUSED'],
      classification: {
        recoverability: ErrorRecoverability.TRANSIENT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RecoveryStrategy.IMMEDIATE_RETRY,
        retryable: true,
        maxRetries: 3,
        retryDelay: 1000,
        shouldRollback: false,
        requiresManualIntervention: false,
        category: 'connection',
        description: 'Connection error',
        suggestedActions: [
          'Check network connectivity',
          'Verify service availability',
          'Check connection limits'
        ]
      }
    },
    
    // Network and connectivity errors (delayed retry)
    {
      messagePattern: /(network|timeout|dns|socket)/i,
      statusCodes: [408, 502, 503, 504, 522, 524],
      classification: {
        recoverability: ErrorRecoverability.TRANSIENT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RecoveryStrategy.DELAYED_RETRY,
        retryable: true,
        maxRetries: 5,
        retryDelay: 2000,
        shouldRollback: false,
        requiresManualIntervention: false,
        category: 'network',
        description: 'Network connectivity issue',
        suggestedActions: [
          'Check network connectivity',
          'Verify DNS resolution',
          'Check firewall settings'
        ]
      }
    },
    
    // Rate limiting (transient)
    {
      messagePattern: /(rate.?limit|too.?many.?requests)/i,
      statusCodes: [429],
      classification: {
        recoverability: ErrorRecoverability.TRANSIENT,
        severity: ErrorSeverity.LOW,
        recoveryStrategy: RecoveryStrategy.DELAYED_RETRY,
        retryable: true,
        maxRetries: 10,
        retryDelay: 5000,
        shouldRollback: false,
        requiresManualIntervention: false,
        category: 'rate_limit',
        description: 'API rate limit exceeded',
        suggestedActions: [
          'Wait for rate limit reset',
          'Implement exponential backoff',
          'Consider request batching'
        ]
      }
    },
    
    // Server errors (potentially transient)
    {
      messagePattern: /(internal.?server.?error|service.?unavailable|bad.?gateway)/i,
      statusCodes: [500, 502, 503],
      classification: {
        recoverability: ErrorRecoverability.TRANSIENT,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.DELAYED_RETRY,
        retryable: true,
        maxRetries: 3,
        retryDelay: 3000,
        shouldRollback: false,
        requiresManualIntervention: false,
        category: 'server_error',
        description: 'Server-side error',
        suggestedActions: [
          'Wait for server recovery',
          'Check service status',
          'Contact support if persistent'
        ]
      }
    },
    
    // Authentication/authorization errors (recoverable)
    {
      messagePattern: /(unauthorized|forbidden|authentication|permission)/i,
      statusCodes: [401, 403],
      classification: {
        recoverability: ErrorRecoverability.RECOVERABLE,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        shouldRollback: false,
        requiresManualIntervention: true,
        category: 'auth',
        description: 'Authentication or authorization failure',
        suggestedActions: [
          'Check credentials',
          'Verify permissions',
          'Refresh authentication tokens'
        ]
      }
    },
    
    // Validation errors (permanent)
    {
      messagePattern: /(validation|invalid|malformed|bad.?request)/i,
      statusCodes: [400, 422],
      classification: {
        recoverability: ErrorRecoverability.PERMANENT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        shouldRollback: true,
        requiresManualIntervention: true,
        category: 'validation',
        description: 'Data validation failure',
        suggestedActions: [
          'Check input data format',
          'Validate against schema',
          'Review API documentation'
        ]
      }
    },
    
    // Critical configuration/file errors (require manual intervention)
    {
      messagePattern: /(critical.?configuration|configuration.?missing|config.?file)/i,
      classification: {
        recoverability: ErrorRecoverability.RECOVERABLE,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        shouldRollback: true,
        requiresManualIntervention: true,
        category: 'filesystem',
        description: 'Critical configuration error',
        suggestedActions: [
          'Check configuration files',
          'Verify file paths',
          'Review configuration syntax'
        ]
      }
    },
    
    // Resource not found (permanent)
    {
      messagePattern: /(not.?found|does.?not.?exist)/i,
      statusCodes: [404],
      classification: {
        recoverability: ErrorRecoverability.PERMANENT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RecoveryStrategy.SKIP,
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        shouldRollback: false,
        requiresManualIntervention: false,
        category: 'not_found',
        description: 'Resource not found',
        suggestedActions: [
          'Verify resource exists',
          'Check resource identifier',
          'Update references if needed'
        ]
      }
    },
    
    // Conflict errors (recoverable)
    {
      messagePattern: /(conflict|already.?exists|duplicate)/i,
      statusCodes: [409],
      classification: {
        recoverability: ErrorRecoverability.RECOVERABLE,
        severity: ErrorSeverity.LOW,
        recoveryStrategy: RecoveryStrategy.SKIP,
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        shouldRollback: false,
        requiresManualIntervention: false,
        category: 'conflict',
        description: 'Resource conflict',
        suggestedActions: [
          'Check if resource already exists',
          'Use update instead of create',
          'Implement idempotency checks'
        ]
      }
    },
    
    // File system errors (potentially recoverable)
    {
      messagePattern: /(file.?not.?found|permission.?denied|disk.?full|enoent|eacces|enospc)/i,
      classification: {
        recoverability: ErrorRecoverability.RECOVERABLE,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        shouldRollback: true,
        requiresManualIntervention: true,
        category: 'filesystem',
        description: 'File system error',
        suggestedActions: [
          'Check file permissions',
          'Verify disk space',
          'Check file paths'
        ]
      }
    }
  ];

  /**
   * Classify an error with comprehensive categorization
   */
  static classifyError(
    error: Error,
    context?: CorrelationContext,
    additionalContext?: Record<string, any>
  ): ClassifiedError {
    const classification = this.determineClassification(error);
    
    const classifiedError: ClassifiedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      classification,
      originalError: error,
      context: additionalContext,
      timestamp: new Date()
    };
    
    // Add correlation information if available
    if (context) {
      classifiedError.correlationId = context.correlationId;
      classifiedError.parentCorrelationId = context.parentCorrelationId;
      classifiedError.operationType = context.operationType;
    }
    
    return classifiedError;
  }

  /**
   * Determine error classification based on patterns
   */
  private static determineClassification(error: Error): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const statusCode = this.extractStatusCode(error);
    const errorType = error.constructor.name;
    
    // Check each pattern
    for (const pattern of this.ERROR_PATTERNS) {
      let matches = false;
      
      // Check message pattern
      if (pattern.messagePattern.test(errorMessage)) {
        matches = true;
      }
      
      // Check status codes
      if (pattern.statusCodes && statusCode && pattern.statusCodes.includes(statusCode)) {
        matches = true;
      }
      
      // Check error types
      if (pattern.errorTypes && pattern.errorTypes.includes(errorType)) {
        matches = true;
      }
      
      if (matches) {
        return { ...pattern.classification };
      }
    }
    
    // Default classification for unknown errors
    return {
      recoverability: ErrorRecoverability.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      retryable: false,
      maxRetries: 0,
      retryDelay: 0,
      shouldRollback: false,
      requiresManualIntervention: true,
      category: 'unknown',
      description: 'Unknown error type',
      suggestedActions: [
        'Review error details',
        'Check logs for more information',
        'Contact support if needed'
      ]
    };
  }

  /**
   * Extract HTTP status code from error
   */
  private static extractStatusCode(error: any): number | undefined {
    // Common properties where status codes might be found
    const statusProperties = ['status', 'statusCode', 'code', 'response.status'];
    
    for (const prop of statusProperties) {
      const value = this.getNestedProperty(error, prop);
      if (typeof value === 'number' && value >= 100 && value < 600) {
        return value;
      }
    }
    
    // Try to parse from message
    const statusMatch = error.message?.match(/status:?\s*(\d{3})/i);
    if (statusMatch) {
      return parseInt(statusMatch[1], 10);
    }
    
    return undefined;
  }

  /**
   * Get nested property value from object
   */
  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if error is retryable based on classification
   */
  static isRetryable(error: ClassifiedError | Error): boolean {
    if ('classification' in error) {
      return error.classification.retryable;
    }
    
    // Quick classification for non-classified errors
    const classification = this.determineClassification(error);
    return classification.retryable;
  }

  /**
   * Get retry configuration for error
   */
  static getRetryConfig(error: ClassifiedError | Error): {
    maxRetries: number;
    retryDelay: number;
    strategy: RecoveryStrategy;
  } {
    const classification = 'classification' in error 
      ? error.classification 
      : this.determineClassification(error);
    
    return {
      maxRetries: classification.maxRetries,
      retryDelay: classification.retryDelay,
      strategy: classification.recoveryStrategy
    };
  }

  /**
   * Check if error requires rollback
   */
  static shouldRollback(error: ClassifiedError | Error): boolean {
    const classification = 'classification' in error 
      ? error.classification 
      : this.determineClassification(error);
    
    return classification.shouldRollback;
  }

  /**
   * Check if error requires manual intervention
   */
  static requiresManualIntervention(error: ClassifiedError | Error): boolean {
    const classification = 'classification' in error 
      ? error.classification 
      : this.determineClassification(error);
    
    return classification.requiresManualIntervention;
  }

  /**
   * Get suggested recovery actions for error
   */
  static getRecoveryActions(error: ClassifiedError | Error): string[] {
    const classification = 'classification' in error 
      ? error.classification 
      : this.determineClassification(error);
    
    return classification.suggestedActions;
  }

  /**
   * Create a summary of error characteristics
   */
  static summarizeError(error: ClassifiedError | Error): {
    recoverability: ErrorRecoverability;
    severity: ErrorSeverity;
    strategy: RecoveryStrategy;
    retryable: boolean;
    requiresIntervention: boolean;
    category: string;
  } {
    const classification = 'classification' in error 
      ? error.classification 
      : this.determineClassification(error);
    
    return {
      recoverability: classification.recoverability,
      severity: classification.severity,
      strategy: classification.recoveryStrategy,
      retryable: classification.retryable,
      requiresIntervention: classification.requiresManualIntervention,
      category: classification.category
    };
  }
}