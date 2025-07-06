/**
 * Correlation Tracking System
 * 
 * Provides correlation IDs for tracking related operations across
 * error handling, recovery workflows, and logging systems.
 */

import { randomUUID } from 'crypto';

/**
 * Correlation context for tracking related operations
 */
export interface CorrelationContext {
  /** Unique correlation ID for the operation chain */
  correlationId: string;
  /** Parent correlation ID if this is a sub-operation */
  parentCorrelationId?: string;
  /** Operation type being tracked */
  operationType: string;
  /** Start timestamp of the operation */
  startTime: Date;
  /** Additional metadata for the operation */
  metadata?: Record<string, any>;
  /** Chain depth for nested operations */
  depth: number;
}

/**
 * Correlation ID manager for tracking operation relationships
 */
export class CorrelationTracker {
  private static instance: CorrelationTracker;
  private currentContext: Map<string, CorrelationContext> = new Map();
  private contextStack: CorrelationContext[] = [];

  private constructor() {}

  /**
   * Get singleton instance of correlation tracker
   */
  static getInstance(): CorrelationTracker {
    if (!CorrelationTracker.instance) {
      CorrelationTracker.instance = new CorrelationTracker();
    }
    return CorrelationTracker.instance;
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return `corr_${randomUUID().substring(0, 8)}_${Date.now()}`;
  }

  /**
   * Start a new correlation context
   */
  startContext(operationType: string, metadata?: Record<string, any>): CorrelationContext {
    const parentContext = this.getCurrentContext();
    const correlationId = this.generateCorrelationId();
    
    const context: CorrelationContext = {
      correlationId,
      parentCorrelationId: parentContext?.correlationId,
      operationType,
      startTime: new Date(),
      metadata: metadata || {},
      depth: parentContext ? parentContext.depth + 1 : 0
    };

    this.currentContext.set(correlationId, context);
    this.contextStack.push(context);
    
    return context;
  }

  /**
   * End a correlation context
   */
  endContext(correlationId: string): void {
    const context = this.currentContext.get(correlationId);
    if (context) {
      // Remove from stack
      const index = this.contextStack.findIndex(c => c.correlationId === correlationId);
      if (index !== -1) {
        this.contextStack.splice(index, 1);
      }
      
      // Keep in map for reference but mark as completed
      context.metadata = { ...context.metadata, completed: true, endTime: new Date() };
    }
  }

  /**
   * Get current correlation context
   */
  getCurrentContext(): CorrelationContext | undefined {
    return this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : undefined;
  }

  /**
   * Get correlation context by ID
   */
  getContext(correlationId: string): CorrelationContext | undefined {
    return this.currentContext.get(correlationId);
  }

  /**
   * Get all child contexts for a parent correlation ID
   */
  getChildContexts(parentCorrelationId: string): CorrelationContext[] {
    return Array.from(this.currentContext.values())
      .filter(context => context.parentCorrelationId === parentCorrelationId);
  }

  /**
   * Get operation chain for a correlation ID
   */
  getOperationChain(correlationId: string): CorrelationContext[] {
    const chain: CorrelationContext[] = [];
    let current = this.currentContext.get(correlationId);
    
    while (current) {
      chain.unshift(current);
      current = current.parentCorrelationId 
        ? this.currentContext.get(current.parentCorrelationId)
        : undefined;
    }
    
    return chain;
  }

  /**
   * Clear expired contexts (older than 1 hour)
   */
  cleanupExpiredContexts(): void {
    const expiryTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    
    for (const [id, context] of this.currentContext.entries()) {
      if (context.startTime < expiryTime && context.metadata?.completed) {
        this.currentContext.delete(id);
      }
    }
  }

  /**
   * Get correlation summary for debugging
   */
  getCorrelationSummary(): {
    activeContexts: number;
    totalContexts: number;
    currentDepth: number;
    longestChain: number;
  } {
    const activeContexts = this.contextStack.length;
    const totalContexts = this.currentContext.size;
    const currentDepth = this.getCurrentContext()?.depth || 0;
    
    let longestChain = 0;
    for (const context of this.currentContext.values()) {
      const chain = this.getOperationChain(context.correlationId);
      longestChain = Math.max(longestChain, chain.length);
    }

    return {
      activeContexts,
      totalContexts,
      currentDepth,
      longestChain
    };
  }

  /**
   * Create a correlation-aware wrapper for async operations
   */
  withCorrelation<T>(
    operationType: string,
    operation: (context: CorrelationContext) => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const context = this.startContext(operationType, metadata);
    
    return operation(context)
      .finally(() => {
        this.endContext(context.correlationId);
      });
  }
}

/**
 * Enhanced error with correlation context
 */
export interface CorrelatedError extends Error {
  correlationId?: string;
  parentCorrelationId?: string;
  operationType?: string;
  operationDepth?: number;
  operationChain?: string[];
  cause?: Error;
}

/**
 * Create an error with correlation context
 */
export function createCorrelatedError(
  message: string,
  originalError?: Error,
  context?: CorrelationContext
): CorrelatedError {
  const error = new Error(message) as CorrelatedError;
  
  if (originalError) {
    error.cause = originalError;
    error.stack = originalError.stack;
  }
  
  if (context) {
    error.correlationId = context.correlationId;
    error.parentCorrelationId = context.parentCorrelationId;
    error.operationType = context.operationType;
    error.operationDepth = context.depth;
    
    const tracker = CorrelationTracker.getInstance();
    const chain = tracker.getOperationChain(context.correlationId);
    error.operationChain = chain.map(c => `${c.operationType}(${c.correlationId})`);
  }
  
  return error;
}

/**
 * Utility function to get current correlation ID
 */
export function getCurrentCorrelationId(): string | undefined {
  const tracker = CorrelationTracker.getInstance();
  return tracker.getCurrentContext()?.correlationId;
}

/**
 * Utility function to format correlation info for logging
 */
export function formatCorrelationInfo(context?: CorrelationContext): string {
  if (!context) {
    const tracker = CorrelationTracker.getInstance();
    context = tracker.getCurrentContext();
  }
  
  if (!context) {
    return '[no-correlation]';
  }
  
  const parts = [
    `id:${context.correlationId}`,
    `op:${context.operationType}`,
    `depth:${context.depth}`
  ];
  
  if (context.parentCorrelationId) {
    parts.push(`parent:${context.parentCorrelationId}`);
  }
  
  return `[${parts.join('|')}]`;
}