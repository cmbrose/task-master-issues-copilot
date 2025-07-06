/**
 * Idempotency Framework with State Tracking
 * 
 * Provides comprehensive state management for:
 * - Processed PRD tracking with content hashing
 * - Generated issue tracking and relationships
 * - Dependency relationship management
 * - Transaction-like operations with rollback
 * - Replay safety and consistency
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ArtifactManager } from './artifact-manager';

/**
 * State for a processed PRD
 */
export interface PrdState {
  /** Content hash of the PRD */
  contentHash: string;
  /** File path of the PRD */
  filePath: string;
  /** Last processed timestamp */
  lastProcessed: Date;
  /** Generated issues from this PRD */
  generatedIssues: string[];
  /** Task graph metadata */
  taskGraphId?: string;
  /** Processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Error information if failed */
  error?: string;
}

/**
 * State for a generated issue
 */
export interface IssueState {
  /** GitHub issue number */
  issueNumber: number;
  /** Issue ID from task graph */
  taskId: string;
  /** Parent task ID if subtask */
  parentTaskId?: string;
  /** Source PRD hash */
  sourceHash: string;
  /** Dependencies (task IDs) */
  dependencies: string[];
  /** Dependents (task IDs) */
  dependents: string[];
  /** Current issue state */
  state: 'open' | 'closed';
  /** Labels applied to issue */
  labels: string[];
  /** Last updated timestamp */
  lastUpdated: Date;
  /** Content hash of issue body */
  bodyHash: string;
}

/**
 * Transaction operation for rollback
 */
export interface TransactionOperation {
  /** Operation type */
  type: 'create_issue' | 'update_issue' | 'delete_issue' | 'update_state';
  /** Target resource identifier */
  target: string;
  /** Previous state for rollback */
  previousState?: any;
  /** New state after operation */
  newState: any;
  /** Timestamp of operation */
  timestamp: Date;
}

/**
 * Transaction context for atomic operations
 */
export interface Transaction {
  /** Unique transaction ID */
  id: string;
  /** Operations in this transaction */
  operations: TransactionOperation[];
  /** Transaction status */
  status: 'active' | 'committed' | 'rolled_back';
  /** Start timestamp */
  startTime: Date;
  /** End timestamp */
  endTime?: Date;
}

/**
 * Complete idempotency state
 */
export interface IdempotencyState {
  /** Processed PRDs by content hash */
  prds: Record<string, PrdState>;
  /** Generated issues by issue number */
  issues: Record<number, IssueState>;
  /** Active transactions */
  transactions: Record<string, Transaction>;
  /** State version for migration */
  version: string;
  /** Last state update timestamp */
  lastUpdated: Date;
}

/**
 * Idempotency Manager for comprehensive state tracking
 */
export class IdempotencyManager {
  private statePath: string;
  private state: IdempotencyState;
  private artifactManager: ArtifactManager;
  private currentTransaction?: Transaction;

  constructor(stateFilePath?: string) {
    this.statePath = stateFilePath || path.join('.taskmaster', 'idempotency-state.json');
    this.artifactManager = new ArtifactManager();
    this.state = this.loadState();
  }

  /**
   * Load idempotency state from file
   */
  private loadState(): IdempotencyState {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, 'utf8');
        const loadedState = JSON.parse(content);
        
        // Convert date strings back to Date objects
        this.deserializeDates(loadedState);
        
        console.log(`📥 Loaded idempotency state from ${this.statePath}`);
        return loadedState;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load idempotency state: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Return default state
    return {
      prds: {},
      issues: {},
      transactions: {},
      version: '1.0.0',
      lastUpdated: new Date()
    };
  }

  /**
   * Save idempotency state to file
   */
  private saveState(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Update timestamp
      this.state.lastUpdated = new Date();

      // Save to file
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
      console.log(`💾 Saved idempotency state to ${this.statePath}`);
    } catch (error) {
      console.error(`❌ Failed to save idempotency state: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Convert date strings back to Date objects after JSON parsing
   */
  private deserializeDates(obj: any): void {
    const dateFields = ['lastProcessed', 'lastUpdated', 'startTime', 'endTime', 'timestamp'];
    
    const traverse = (current: any) => {
      if (typeof current !== 'object' || current === null) return;
      
      for (const key in current) {
        if (dateFields.includes(key) && typeof current[key] === 'string') {
          current[key] = new Date(current[key]);
        } else if (typeof current[key] === 'object') {
          traverse(current[key]);
        }
      }
    };

    traverse(obj);
  }

  /**
   * Calculate comprehensive content hash for PRD
   */
  calculatePrdHash(content: string, filePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    hash.update(filePath); // Include path to detect moves
    return hash.digest('hex');
  }

  /**
   * Calculate content hash for issue body
   */
  calculateIssueBodyHash(body: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(body);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Check if PRD has been processed and if it has changed
   */
  checkPrdState(content: string, filePath: string): {
    isProcessed: boolean;
    hasChanged: boolean;
    state?: PrdState;
  } {
    const contentHash = this.calculatePrdHash(content, filePath);
    const existing = this.state.prds[contentHash];
    
    if (!existing) {
      // Check if we have an older version by file path
      const oldVersion = Object.values(this.state.prds).find(p => p.filePath === filePath);
      return {
        isProcessed: false,
        hasChanged: !!oldVersion,
        state: oldVersion
      };
    }

    return {
      isProcessed: true,
      hasChanged: false,
      state: existing
    };
  }

  /**
   * Start a new transaction for atomic operations
   */
  beginTransaction(): string {
    const transactionId = crypto.randomUUID();
    
    this.currentTransaction = {
      id: transactionId,
      operations: [],
      status: 'active',
      startTime: new Date()
    };

    this.state.transactions[transactionId] = this.currentTransaction;
    console.log(`🔄 Started transaction ${transactionId}`);
    
    return transactionId;
  }

  /**
   * Add operation to current transaction
   */
  addTransactionOperation(operation: Omit<TransactionOperation, 'timestamp'>): void {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    const fullOperation: TransactionOperation = {
      ...operation,
      timestamp: new Date()
    };

    this.currentTransaction.operations.push(fullOperation);
    console.log(`📝 Added operation: ${operation.type} on ${operation.target}`);
  }

  /**
   * Commit current transaction
   */
  commitTransaction(): void {
    if (!this.currentTransaction) {
      throw new Error('No active transaction to commit');
    }

    this.currentTransaction.status = 'committed';
    this.currentTransaction.endTime = new Date();
    
    console.log(`✅ Committed transaction ${this.currentTransaction.id} with ${this.currentTransaction.operations.length} operations`);
    
    this.currentTransaction = undefined;
    this.saveState();
  }

  /**
   * Rollback current transaction
   */
  rollbackTransaction(): void {
    if (!this.currentTransaction) {
      throw new Error('No active transaction to rollback');
    }

    console.log(`🔄 Rolling back transaction ${this.currentTransaction.id}`);
    
    // Process operations in reverse order
    for (let i = this.currentTransaction.operations.length - 1; i >= 0; i--) {
      const operation = this.currentTransaction.operations[i];
      this.rollbackOperation(operation);
    }

    this.currentTransaction.status = 'rolled_back';
    this.currentTransaction.endTime = new Date();
    
    console.log(`❌ Rolled back transaction ${this.currentTransaction.id}`);
    
    this.currentTransaction = undefined;
    this.saveState();
  }

  /**
   * Rollback a single operation
   */
  private rollbackOperation(operation: TransactionOperation): void {
    console.log(`⮪ Rolling back: ${operation.type} on ${operation.target}`);
    
    switch (operation.type) {
      case 'create_issue':
        // Remove issue from state
        const issueNumber = parseInt(operation.target);
        delete this.state.issues[issueNumber];
        break;
        
      case 'update_issue':
        // Restore previous issue state
        if (operation.previousState) {
          const issueNumber = parseInt(operation.target);
          this.state.issues[issueNumber] = operation.previousState;
        }
        break;
        
      case 'update_state':
        // Restore previous PRD state
        if (operation.previousState) {
          this.state.prds[operation.target] = operation.previousState;
        } else {
          delete this.state.prds[operation.target];
        }
        break;
    }
  }

  /**
   * Record PRD processing start
   */
  recordPrdProcessingStart(content: string, filePath: string, taskGraphId?: string): string {
    const contentHash = this.calculatePrdHash(content, filePath);
    const existing = this.state.prds[contentHash];
    
    if (!this.currentTransaction) {
      throw new Error('Must be in a transaction to record PRD processing');
    }

    this.addTransactionOperation({
      type: 'update_state',
      target: contentHash,
      previousState: existing ? { ...existing } : undefined,
      newState: {
        contentHash,
        filePath,
        lastProcessed: new Date(),
        generatedIssues: existing?.generatedIssues || [],
        taskGraphId,
        status: 'processing' as const
      }
    });

    this.state.prds[contentHash] = {
      contentHash,
      filePath,
      lastProcessed: new Date(),
      generatedIssues: existing?.generatedIssues || [],
      taskGraphId,
      status: 'processing'
    };

    return contentHash;
  }

  /**
   * Record PRD processing completion
   */
  recordPrdProcessingComplete(contentHash: string, generatedIssues: number[]): void {
    const existing = this.state.prds[contentHash];
    if (!existing) {
      throw new Error(`PRD state not found for hash ${contentHash}`);
    }

    if (!this.currentTransaction) {
      throw new Error('Must be in a transaction to record PRD completion');
    }

    const issueNumbers = generatedIssues.map(n => n.toString());
    
    this.addTransactionOperation({
      type: 'update_state',
      target: contentHash,
      previousState: { ...existing },
      newState: {
        ...existing,
        generatedIssues: issueNumbers,
        status: 'completed' as const,
        lastProcessed: new Date()
      }
    });

    this.state.prds[contentHash] = {
      ...existing,
      generatedIssues: issueNumbers,
      status: 'completed',
      lastProcessed: new Date()
    };
  }

  /**
   * Record PRD processing failure
   */
  recordPrdProcessingFailure(contentHash: string, error: string): void {
    const existing = this.state.prds[contentHash];
    if (!existing) {
      throw new Error(`PRD state not found for hash ${contentHash}`);
    }

    if (!this.currentTransaction) {
      throw new Error('Must be in a transaction to record PRD failure');
    }

    this.addTransactionOperation({
      type: 'update_state',
      target: contentHash,
      previousState: { ...existing },
      newState: {
        ...existing,
        status: 'failed' as const,
        error,
        lastProcessed: new Date()
      }
    });

    this.state.prds[contentHash] = {
      ...existing,
      status: 'failed',
      error,
      lastProcessed: new Date()
    };
  }

  /**
   * Record issue creation
   */
  recordIssueCreation(
    issueNumber: number,
    taskId: string,
    sourceHash: string,
    body: string,
    labels: string[],
    dependencies: string[] = [],
    parentTaskId?: string
  ): void {
    if (!this.currentTransaction) {
      throw new Error('Must be in a transaction to record issue creation');
    }

    const issueState: IssueState = {
      issueNumber,
      taskId,
      parentTaskId,
      sourceHash,
      dependencies,
      dependents: [],
      state: 'open',
      labels,
      lastUpdated: new Date(),
      bodyHash: this.calculateIssueBodyHash(body)
    };

    this.addTransactionOperation({
      type: 'create_issue',
      target: issueNumber.toString(),
      newState: issueState
    });

    this.state.issues[issueNumber] = issueState;

    // Update dependents
    this.updateDependents(taskId, dependencies);
  }

  /**
   * Record issue update
   */
  recordIssueUpdate(
    issueNumber: number,
    body?: string,
    labels?: string[],
    state?: 'open' | 'closed'
  ): void {
    const existing = this.state.issues[issueNumber];
    if (!existing) {
      throw new Error(`Issue state not found for issue #${issueNumber}`);
    }

    if (!this.currentTransaction) {
      throw new Error('Must be in a transaction to record issue update');
    }

    const updated: IssueState = {
      ...existing,
      lastUpdated: new Date()
    };

    if (body) {
      updated.bodyHash = this.calculateIssueBodyHash(body);
    }
    if (labels) {
      updated.labels = labels;
    }
    if (state) {
      updated.state = state;
    }

    this.addTransactionOperation({
      type: 'update_issue',
      target: issueNumber.toString(),
      previousState: { ...existing },
      newState: updated
    });

    this.state.issues[issueNumber] = updated;
  }

  /**
   * Update dependent relationships
   */
  private updateDependents(taskId: string, dependencies: string[]): void {
    for (const depTaskId of dependencies) {
      // Find issue for dependency task
      const depIssue = Object.values(this.state.issues).find(i => i.taskId === depTaskId);
      if (depIssue && !depIssue.dependents.includes(taskId)) {
        depIssue.dependents.push(taskId);
      }
    }
  }

  /**
   * Check if operation is safe to replay
   */
  isReplaySafe(operation: 'create_prd' | 'update_prd' | 'create_issue' | 'update_issue', target: string): boolean {
    switch (operation) {
      case 'create_prd':
        // Safe if PRD not already processed successfully
        const prd = this.state.prds[target];
        return !prd || prd.status !== 'completed';
        
      case 'create_issue':
        // Safe if issue doesn't exist
        const issueNumber = parseInt(target);
        return !this.state.issues[issueNumber];
        
      case 'update_issue':
        // Always safe to replay updates
        return true;
        
      case 'update_prd':
        // Always safe to replay PRD updates
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Get dependency chain for a task
   */
  getDependencyChain(taskId: string): { dependencies: string[]; dependents: string[] } {
    const issue = Object.values(this.state.issues).find(i => i.taskId === taskId);
    if (!issue) {
      return { dependencies: [], dependents: [] };
    }
    
    return {
      dependencies: issue.dependencies,
      dependents: issue.dependents
    };
  }

  /**
   * Get issues that need updates due to PRD changes
   */
  getIssuesNeedingUpdate(contentHash: string): IssueState[] {
    return Object.values(this.state.issues).filter(issue => issue.sourceHash === contentHash);
  }

  /**
   * Clean up old transactions
   */
  cleanupOldTransactions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;
    
    for (const [id, transaction] of Object.entries(this.state.transactions)) {
      if (transaction.status !== 'active' && transaction.startTime < cutoff) {
        delete this.state.transactions[id];
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old transactions`);
      this.saveState();
    }
  }

  /**
   * Get current state summary
   */
  getStateSummary(): {
    totalPrds: number;
    processedPrds: number;
    totalIssues: number;
    activeTransactions: number;
    lastUpdated: Date;
  } {
    return {
      totalPrds: Object.keys(this.state.prds).length,
      processedPrds: Object.values(this.state.prds).filter(p => p.status === 'completed').length,
      totalIssues: Object.keys(this.state.issues).length,
      activeTransactions: Object.values(this.state.transactions).filter(t => t.status === 'active').length,
      lastUpdated: this.state.lastUpdated
    };
  }

  /**
   * Export state for debugging or backup
   */
  exportState(): IdempotencyState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Import state from backup
   */
  importState(state: IdempotencyState): void {
    this.state = state;
    this.deserializeDates(this.state);
    this.saveState();
    console.log(`📥 Imported idempotency state`);
  }
}