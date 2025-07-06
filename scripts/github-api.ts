/**
 * Enhanced GitHub API Integration Module
 * 
 * Provides robust GitHub API operations with:
 * - Rate limiting handling with exponential backoff
 * - Comprehensive error handling and retry logic  
 * - Idempotency checks with improved duplicate detection
 * - Concurrent request management with proper queuing
 * - Detailed logging and recovery mechanisms
 */

import { Octokit } from '@octokit/rest';
import { components } from "@octokit/openapi-types";

// GitHub API types
export type ApiIssue = components["schemas"]["issue"];

/**
 * Configuration for GitHub API operations
 */
export interface GitHubApiConfig {
  /** GitHub token for authentication */
  token: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Maximum concurrent requests (default: 3) */
  maxConcurrent?: number;
  /** Base delay for retry backoff in ms (default: 1000) */
  retryDelay?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Enable circuit breaker (default: true) */
  enableCircuitBreaker?: boolean;
  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset timeout in ms (default: 60000) */
  circuitBreakerTimeout?: number;
  /** Enable graceful degradation (default: true) */
  enableGracefulDegradation?: boolean;
  /** Operation timeout in ms (default: 30000) */
  operationTimeout?: number;
  /** Batch processing configuration */
  batchConfig?: BatchProcessingConfig;
}

/**
 * Configuration for batch processing optimization
 */
export interface BatchProcessingConfig {
  /** Enable adaptive batch sizing (default: true) */
  enableAdaptiveBatching?: boolean;
  /** Minimum batch size (default: 5) */
  minBatchSize?: number;
  /** Maximum batch size (default: 50) */
  maxBatchSize?: number;
  /** Base batch size (default: 15) */
  baseBatchSize?: number;
  /** Rate limit threshold for batch size adjustment (default: 0.2) */
  rateLimitThreshold?: number;
  /** Error rate threshold for batch size reduction (default: 0.1) */
  errorRateThreshold?: number;
  /** Enable batch retry on partial failure (default: true) */
  enableBatchRetry?: boolean;
  /** Enable progress checkpointing (default: true) */
  enableCheckpointing?: boolean;
  /** Maximum operations per checkpoint (default: 100) */
  checkpointInterval?: number;
}

/**
 * Rate limiting information from GitHub API
 */
export interface RateLimitInfo {
  /** Remaining requests */
  remaining: number;
  /** Total request limit */
  limit: number;
  /** Reset time as Unix timestamp */
  reset: number;
  /** Whether we're currently rate limited */
  isLimited: boolean;
}

/**
 * Error categories for different retry strategies
 */
export enum GitHubErrorCategory {
  RATE_LIMITED = 'rate_limited',
  NETWORK = 'network', 
  AUTH = 'auth',
  NOT_FOUND = 'not_found',
  VALIDATION = 'validation',
  SERVER = 'server',
  TIMEOUT = 'timeout',
  CIRCUIT_BREAKER = 'circuit_breaker',
  UNKNOWN = 'unknown'
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open', 
  HALF_OPEN = 'half_open'
}

/**
 * Operation priority levels for graceful degradation
 */
export enum OperationPriority {
  CRITICAL = 'critical',    // Must succeed (auth, rate limit checks)
  HIGH = 'high',           // Important (create/update issues)
  MEDIUM = 'medium',       // Nice to have (list operations)
  LOW = 'low'             // Optional (metrics, cache updates)
}

/**
 * Batch operation result for tracking success/failure rates
 */
export interface BatchOperationResult<T> {
  /** Successfully processed items */
  successful: Array<{ item: T; result: any }>;
  /** Failed items with their errors */
  failed: Array<{ item: T; error: GitHubApiError }>;
  /** Processing metrics */
  metrics: BatchMetrics;
}

/**
 * Metrics for batch processing performance
 */
export interface BatchMetrics {
  /** Total items processed */
  totalItems: number;
  /** Successful operations */
  successfulItems: number;
  /** Failed operations */
  failedItems: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Batch size used */
  batchSize: number;
  /** Number of batches processed */
  batchCount: number;
  /** Average operations per second */
  operationsPerSecond: number;
  /** Rate limit info at completion */
  rateLimitInfo?: RateLimitInfo;
}

/**
 * Progress checkpoint for large operations
 */
export interface ProcessingCheckpoint {
  /** Total items to process */
  totalItems: number;
  /** Items processed so far */
  processedItems: number;
  /** Items successfully completed */
  completedItems: number;
  /** Items that failed */
  failedItems: number;
  /** Current batch size being used */
  currentBatchSize: number;
  /** Processing start time */
  startTime: Date;
  /** Last update time */
  lastUpdateTime: Date;
  /** Estimated completion time */
  estimatedCompletionTime?: Date;
}

/**
 * Detailed error information
 */
export interface GitHubApiError extends Error {
  category: GitHubErrorCategory;
  status?: number;
  rateLimitInfo?: RateLimitInfo;
  retryAfter?: number;
  retryable: boolean;
  operation?: string;
  timestamp?: Date;
  attempt?: number;
  details?: any;
}

/**
 * Error metrics for monitoring
 */
export interface ErrorMetrics {
  total: number;
  byCategory: Record<GitHubErrorCategory, number>;
  byOperation: Record<string, number>;
  recentFailures: Array<{
    timestamp: Date;
    category: GitHubErrorCategory;
    operation: string;
    error: string;
  }>;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

/**
 * Request queue item for managing concurrency
 */
interface QueueItem {
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  category: string;
  priority: OperationPriority;
  timeout?: NodeJS.Timeout;
  createdAt: Date;
}

/**
 * Enhanced GitHub API client with rate limiting and error handling
 */
export class EnhancedGitHubApi {
  private octokit: Octokit;
  private config: Required<GitHubApiConfig>;
  private requestQueue: QueueItem[] = [];
  private activeRequests = 0;
  private rateLimitInfo: RateLimitInfo | null = null;
  private rateLimitResetTimer: NodeJS.Timeout | null = null;
  
  // Enhanced error handling
  private errorMetrics: ErrorMetrics;
  private circuitBreaker: CircuitBreakerMetrics;
  private isHealthy = true;
  private lastHealthCheck?: Date;

  constructor(config: GitHubApiConfig) {
    this.config = {
      maxConcurrent: 3,
      retryDelay: 1000,
      maxRetries: 3,
      debug: false,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      enableGracefulDegradation: true,
      operationTimeout: 30000,
      batchConfig: {
        enableAdaptiveBatching: true,
        minBatchSize: 5,
        maxBatchSize: 50,
        baseBatchSize: 15,
        rateLimitThreshold: 0.2,
        errorRateThreshold: 0.1,
        enableBatchRetry: true,
        enableCheckpointing: true,
        checkpointInterval: 100,
        ...config.batchConfig
      },
      ...config
    };

    // Initialize error metrics
    this.errorMetrics = {
      total: 0,
      byCategory: {} as Record<GitHubErrorCategory, number>,
      byOperation: {},
      recentFailures: []
    };

    // Initialize circuit breaker
    this.circuitBreaker = {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0
    };

    this.octokit = new Octokit({ 
      auth: this.config.token,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          this.log(`Rate limit exceeded. Retrying after ${retryAfter} seconds`, 'warn');
          return true; // Retry
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          this.log(`Secondary rate limit exceeded. Retrying after ${retryAfter} seconds`, 'warn');
          return true; // Retry
        }
      }
    });

    // Initialize all error categories in metrics
    Object.values(GitHubErrorCategory).forEach(category => {
      this.errorMetrics.byCategory[category] = 0;
    });
  }

  /**
   * Get direct access to the underlying Octokit client for advanced operations
   */
  get client(): Octokit {
    return this.octokit;
  }

  /**
   * Execute a GitHub API operation with full error handling and retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    category: string = 'general',
    priority: OperationPriority = OperationPriority.MEDIUM
  ): Promise<T> {
    // Check circuit breaker state
    if (this.config.enableCircuitBreaker && this.circuitBreaker.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (!this.circuitBreaker.nextRetryTime || now < this.circuitBreaker.nextRetryTime.getTime()) {
        const error = new Error(`Circuit breaker is OPEN. Next retry at ${this.circuitBreaker.nextRetryTime?.toISOString()}`);
        (error as any).category = GitHubErrorCategory.CIRCUIT_BREAKER;
        throw error;
      } else {
        // Transition to half-open
        this.circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
        this.log('Circuit breaker transitioning to HALF_OPEN', 'info');
      }
    }

    return new Promise((resolve, reject) => {
      const queueItem: QueueItem = {
        operation,
        resolve: (value: any) => {
          this.onOperationSuccess(category);
          resolve(value);
        },
        reject: (error: any) => {
          this.onOperationFailure(error, category);
          reject(error);
        },
        retryCount: 0,
        category,
        priority,
        createdAt: new Date()
      };

      // Add operation timeout
      if (this.config.operationTimeout > 0) {
        queueItem.timeout = setTimeout(() => {
          const timeoutError = new Error(`Operation ${category} timed out after ${this.config.operationTimeout}ms`);
          (timeoutError as any).category = GitHubErrorCategory.TIMEOUT;
          queueItem.reject(timeoutError);
        }, this.config.operationTimeout);
      }

      // Insert based on priority
      this.insertByPriority(queueItem);
      this.processQueue();
    });
  }

  /**
   * Insert queue item based on priority
   */
  private insertByPriority(item: QueueItem): void {
    const priorities = [OperationPriority.CRITICAL, OperationPriority.HIGH, OperationPriority.MEDIUM, OperationPriority.LOW];
    const itemPriorityIndex = priorities.indexOf(item.priority);
    
    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuePriorityIndex = priorities.indexOf(this.requestQueue[i].priority);
      if (itemPriorityIndex < queuePriorityIndex) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, item);
  }

  /**
   * Handle operation success for circuit breaker and metrics
   */
  private onOperationSuccess(category: string): void {
    if (this.config.enableCircuitBreaker) {
      if (this.circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
        this.circuitBreaker.state = CircuitBreakerState.CLOSED;
        this.circuitBreaker.failureCount = 0;
        this.log('Circuit breaker reset to CLOSED', 'info');
      }
      this.circuitBreaker.lastSuccessTime = new Date();
    }
  }

  /**
   * Handle operation failure for circuit breaker and metrics
   */
  private onOperationFailure(error: any, category: string): void {
    if (this.config.enableCircuitBreaker && error.category !== GitHubErrorCategory.RATE_LIMITED) {
      this.circuitBreaker.failureCount++;
      this.circuitBreaker.lastFailureTime = new Date();

      if (this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
        this.circuitBreaker.state = CircuitBreakerState.OPEN;
        this.circuitBreaker.nextRetryTime = new Date(Date.now() + this.config.circuitBreakerTimeout);
        this.log(`Circuit breaker OPEN. Next retry at ${this.circuitBreaker.nextRetryTime.toISOString()}`, 'error');
      }
    }
  }
  /**
   * Process the request queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.config.maxConcurrent || this.requestQueue.length === 0) {
      return;
    }

    // Check if we're rate limited
    if (this.rateLimitInfo?.isLimited) {
      const waitTime = (this.rateLimitInfo.reset * 1000) - Date.now();
      if (waitTime > 0) {
        this.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds`, 'warn');
        setTimeout(() => this.processQueue(), waitTime);
        return;
      }
    }

    const item = this.requestQueue.shift();
    if (!item) return;

    this.activeRequests++;
    
    try {
      const result = await this.executeOperation(item);
      
      // Clear timeout if operation completed successfully
      if (item.timeout) {
        clearTimeout(item.timeout);
      }
      
      item.resolve(result);
    } catch (error) {
      // Clear timeout on error as well
      if (item.timeout) {
        clearTimeout(item.timeout);
      }
      
      const shouldRetry = await this.handleError(error as Error, item);
      if (shouldRetry) {
        this.insertByPriority(item); // Retry with priority
      } else {
        item.reject(error);
      }
    } finally {
      this.activeRequests--;
      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Execute a single operation with rate limit tracking
   */
  private async executeOperation(item: QueueItem): Promise<any> {
    this.log(`Executing ${item.category} operation (attempt ${item.retryCount + 1}, priority: ${item.priority})`, 'debug');
    
    const result = await item.operation();
    
    // Update rate limit info if available in response headers
    if (result && typeof result === 'object' && 'headers' in result) {
      this.updateRateLimitInfo(result.headers);
    }
    
    return result;
  }

  /**
   * Handle API errors with categorization and retry logic
   */
  private async handleError(error: Error, item: QueueItem): Promise<boolean> {
    const apiError = this.categorizeError(error);
    
    // Update error metrics
    this.updateErrorMetrics(apiError, item.category);
    
    this.log(`API error in ${item.category}: ${apiError.message} (category: ${apiError.category}, attempt: ${item.retryCount + 1})`, 'error');

    // Update retry count
    item.retryCount++;

    // Check if we should retry
    if (!apiError.retryable || item.retryCount >= this.config.maxRetries) {
      this.log(`Not retrying ${item.category} after ${item.retryCount} attempts`, 'warn');
      
      // For critical operations, try graceful degradation
      if (this.config.enableGracefulDegradation && item.priority === OperationPriority.CRITICAL) {
        this.log(`Attempting graceful degradation for critical operation ${item.category}`, 'warn');
        return this.attemptGracefulDegradation(item, apiError);
      }
      
      return false;
    }

    // Calculate delay based on error type and retry count
    const delay = this.calculateRetryDelay(apiError, item.retryCount);
    this.log(`Retrying ${item.category} in ${delay}ms (attempt ${item.retryCount + 1})`, 'info');

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return true;
  }

  /**
   * Update error metrics for monitoring
   */
  private updateErrorMetrics(error: GitHubApiError, operation: string): void {
    this.errorMetrics.total++;
    this.errorMetrics.byCategory[error.category]++;
    this.errorMetrics.byOperation[operation] = (this.errorMetrics.byOperation[operation] || 0) + 1;
    
    // Keep recent failures (last 50)
    this.errorMetrics.recentFailures.push({
      timestamp: new Date(),
      category: error.category,
      operation,
      error: error.message
    });
    
    if (this.errorMetrics.recentFailures.length > 50) {
      this.errorMetrics.recentFailures.shift();
    }
  }

  /**
   * Attempt graceful degradation for critical operations
   */
  private async attemptGracefulDegradation(item: QueueItem, error: GitHubApiError): Promise<boolean> {
    switch (error.category) {
      case GitHubErrorCategory.NETWORK:
        // For network errors, try to continue with cached data or simplified operations
        this.log(`Network error: attempting to continue with degraded functionality`, 'warn');
        return false; // For now, don't retry but log the attempt
        
      case GitHubErrorCategory.AUTH:
        // For auth errors, there's not much we can do gracefully
        this.log(`Authentication error: cannot proceed with degraded mode`, 'error');
        return false;
        
      case GitHubErrorCategory.RATE_LIMITED:
        // Rate limiting should be handled by normal retry logic
        this.log(`Rate limited: using normal retry logic`, 'info');
        return true;
        
      case GitHubErrorCategory.SERVER:
        // Server errors might be temporary, try simplified requests
        this.log(`Server error: attempting simplified request`, 'warn');
        return false;
        
      default:
        this.log(`Unknown error category: ${error.category} - cannot degrade gracefully`, 'warn');
        return false;
    }
  }
  /**
   * Categorize API errors for appropriate handling
   */
  private categorizeError(error: Error): GitHubApiError {
    const apiError = error as any;
    let category = GitHubErrorCategory.UNKNOWN;
    let retryable = false;
    let rateLimitInfo: RateLimitInfo | undefined;
    let retryAfter: number | undefined;

    // Check for timeout errors first
    if (error.message?.includes('timeout') || apiError.code === 'TIMEOUT' || error.message?.includes('timed out')) {
      category = GitHubErrorCategory.TIMEOUT;
      retryable = true;
    } else if (apiError.status) {
      switch (Math.floor(apiError.status / 100)) {
        case 4: // 4xx errors
          switch (apiError.status) {
            case 401:
            case 403:
              category = GitHubErrorCategory.AUTH;
              break;
            case 404:
              category = GitHubErrorCategory.NOT_FOUND;
              break;
            case 422:
              category = GitHubErrorCategory.VALIDATION;
              break;
            case 429: // Rate limited
              category = GitHubErrorCategory.RATE_LIMITED;
              retryable = true;
              retryAfter = apiError.response?.headers?.['retry-after'] 
                ? parseInt(apiError.response.headers['retry-after']) * 1000 
                : undefined;
              break;
            default:
              category = GitHubErrorCategory.VALIDATION;
          }
          break;
        case 5: // 5xx errors
          category = GitHubErrorCategory.SERVER;
          retryable = true;
          break;
        default:
          retryable = true;
      }
    } else if (apiError.code) {
      // Network-level errors
      switch (apiError.code) {
        case 'ECONNRESET':
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
        case 'ETIMEDOUT':
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
          category = GitHubErrorCategory.NETWORK;
          retryable = true;
          break;
      }
    }

    const enhancedError = Object.assign(error, {
      category,
      status: apiError.status,
      rateLimitInfo,
      retryAfter,
      retryable,
      timestamp: new Date()
    }) as GitHubApiError;
    
    return enhancedError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(error: GitHubApiError, retryCount: number): number {
    // Use specific retry-after header if available
    if (error.retryAfter) {
      return error.retryAfter;
    }

    // Different delays for different error types
    switch (error.category) {
      case GitHubErrorCategory.RATE_LIMITED:
        // More aggressive backoff for rate limiting
        return Math.min(60000, this.config.retryDelay * Math.pow(2, retryCount)); // Max 1 minute
      
      case GitHubErrorCategory.NETWORK:
        // Faster retry for network issues
        return Math.min(10000, this.config.retryDelay * Math.pow(1.5, retryCount)); // Max 10 seconds
      
      case GitHubErrorCategory.SERVER:
        // Standard backoff for server errors
        return Math.min(30000, this.config.retryDelay * Math.pow(2, retryCount)); // Max 30 seconds
      
      case GitHubErrorCategory.TIMEOUT:
        // Shorter delays for timeouts
        return Math.min(5000, this.config.retryDelay * Math.pow(1.2, retryCount)); // Max 5 seconds
      
      default:
        // Standard exponential backoff for other errors
        const baseDelay = this.config.retryDelay;
        const jitter = Math.random() * 0.1 * baseDelay; // Add 10% jitter
        return Math.min(30000, baseDelay * Math.pow(2, retryCount) + jitter); // Max 30 seconds
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(headers: any): void {
    const remaining = parseInt(headers['x-ratelimit-remaining']) || 0;
    const limit = parseInt(headers['x-ratelimit-limit']) || 5000;
    const reset = parseInt(headers['x-ratelimit-reset']) || 0;

    this.rateLimitInfo = {
      remaining,
      limit,
      reset,
      isLimited: remaining === 0 && reset > Date.now() / 1000
    };

    this.log(`Rate limit: ${remaining}/${limit} remaining, resets at ${new Date(reset * 1000).toISOString()}`, 'info');

    // Set up timer to clear rate limit status
    if (this.rateLimitInfo.isLimited && this.rateLimitResetTimer) {
      clearTimeout(this.rateLimitResetTimer);
    }
    
    if (this.rateLimitInfo.isLimited) {
      const waitTime = (reset * 1000) - Date.now();
      this.rateLimitResetTimer = setTimeout(() => {
        if (this.rateLimitInfo) {
          this.rateLimitInfo.isLimited = false;
        }
        this.processQueue(); // Resume processing
      }, waitTime);
    }
  }

  /**
   * Check if an issue already exists with improved duplicate detection
   */
  async findExistingIssue(title: string, uniqueMarker?: string): Promise<ApiIssue | null> {
    return this.executeWithRetry(async () => {
      // Search for issues with the exact title
      const searchQuery = `repo:${this.config.owner}/${this.config.repo} in:title "${title}"`;
      const searchResult = await this.octokit.search.issuesAndPullRequests({
        q: searchQuery,
        per_page: 10
      });

      // Look for exact matches
      for (const issue of searchResult.data.items) {
        if (issue.title === title) {
          // If we have a unique marker, check for it in the body
          if (uniqueMarker && issue.body && issue.body.includes(uniqueMarker)) {
            return issue as ApiIssue;
          } else if (!uniqueMarker) {
            return issue as ApiIssue;
          }
        }
      }

      return null;
    }, 'find-existing-issue', OperationPriority.MEDIUM);
  }

  /**
   * Create a new issue with enhanced error handling
   */
  async createIssue(params: {
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<ApiIssue> {
    return this.executeWithRetry(async () => {
      const response = await this.octokit.issues.create({
        owner: this.config.owner,
        repo: this.config.repo,
        ...params
      });
      return response.data as ApiIssue;
    }, 'create-issue', OperationPriority.HIGH);
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueNumber: number, params: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
  }): Promise<ApiIssue> {
    return this.executeWithRetry(async () => {
      const response = await this.octokit.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        ...params
      });
      return response.data as ApiIssue;
    }, 'update-issue', OperationPriority.HIGH);
  }

  /**
   * List issues with pagination support
   */
  async listIssues(params: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    per_page?: number;
    page?: number;
  } = {}): Promise<ApiIssue[]> {
    return this.executeWithRetry(async () => {
      const response = await this.octokit.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        state: 'all',
        per_page: 100,
        ...params
      });
      return response.data as ApiIssue[];
    }, 'list-issues', OperationPriority.MEDIUM);
  }

  /**
   * Get sub-issues for a given issue by parsing issue relationships
   */
  async getSubIssues(issueNumber: number): Promise<ApiIssue[]> {
    return this.executeWithRetry(async () => {
      // Get the parent issue to parse its body for sub-issue references
      const parentIssue = await this.octokit.issues.get({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber
      });

      const subIssueNumbers = this.parseSubIssuesFromBody(parentIssue.data.body || '');
      
      // Fetch each sub-issue
      const subIssues: ApiIssue[] = [];
      for (const subIssueNumber of subIssueNumbers) {
        try {
          const subIssue = await this.octokit.issues.get({
            owner: this.config.owner,
            repo: this.config.repo,
            issue_number: subIssueNumber
          });
          subIssues.push(subIssue.data as ApiIssue);
        } catch (error) {
      this.log(`Failed to fetch sub-issue #${subIssueNumber}: ${error}`, 'warn');
        }
      }
      
      return subIssues;
    }, 'get-sub-issues', OperationPriority.MEDIUM);
  }

  /**
   * Parse sub-issue numbers from issue body content
   */
  private parseSubIssuesFromBody(body: string): number[] {
    const subIssueNumbers: number[] = [];
    
    // Look for sub-issue references in various formats:
    // - "## Subtasks" or "## Sub-issues" sections (markdown headers)
    // - "- Required By:" or "## Required By" sections  
    
    const issueRefRegex = /#(\d+)/g;
    const subtaskSectionRegex = /##\s*(?:Subtasks?|Sub-issues?|subtasks?|sub-issues?)\s*\n((?:\s*-\s*\[[\sx]\]\s*#\d+.*\n?)*)/gmi;
    const requiredByRegex = /(?:##\s*(?:Required By|required by)|(?:^|\n)\s*-\s*\*\*Required By:\*\*|\n\s*Required By:)\s*\n((?:\s*-\s*\[[\sx]\]\s*#\d+.*\n?)*)/gmi;
    
    // Extract from subtask sections
    let match;
    while ((match = subtaskSectionRegex.exec(body)) !== null) {
      const section = match[1];
      let issueMatch;
      while ((issueMatch = issueRefRegex.exec(section)) !== null) {
        subIssueNumbers.push(parseInt(issueMatch[1]));
      }
      // Reset lastIndex for the inner regex
      issueRefRegex.lastIndex = 0;
    }
    
    // Reset lastIndex for the section regex
    subtaskSectionRegex.lastIndex = 0;
    
    // Extract from required by sections  
    while ((match = requiredByRegex.exec(body)) !== null) {
      const section = match[1];
      let issueMatch;
      while ((issueMatch = issueRefRegex.exec(section)) !== null) {
        subIssueNumbers.push(parseInt(issueMatch[1]));
      }
      // Reset lastIndex for the inner regex
      issueRefRegex.lastIndex = 0;
    }
    
    return Array.from(new Set(subIssueNumbers)); // Remove duplicates
  }

  /**
   * Add a sub-issue relationship by updating issue bodies and metadata
   */
  async addSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void> {
    return this.executeWithRetry(async () => {
      // Get both issues
      const [parentIssue, subIssue] = await Promise.all([
        this.octokit.issues.get({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: parentIssueNumber
        }),
        this.octokit.issues.get({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: subIssueNumber
        })
      ]);

      // Update parent issue body to include sub-issue reference
      const updatedParentBody = this.addSubIssueToBody(
        parentIssue.data.body || '', 
        subIssueNumber,
        subIssue.data.state === 'closed'
      );

      // Update sub-issue body to reference parent
      const updatedSubIssueBody = this.addParentReferenceToBody(
        subIssue.data.body || '',
        parentIssueNumber
      );

      // Update both issues
      await Promise.all([
        this.octokit.issues.update({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: parentIssueNumber,
          body: updatedParentBody
        }),
        this.octokit.issues.update({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: subIssueNumber,
          body: updatedSubIssueBody
        })
      ]);

      this.log(`Added sub-issue relationship: #${parentIssueNumber} -> #${subIssueNumber}`, 'info');
    }, 'add-sub-issue', OperationPriority.HIGH);
  }

  /**
   * Add sub-issue reference to parent issue body
   */
  private addSubIssueToBody(body: string, subIssueNumber: number, isCompleted: boolean): string {
    const checkbox = isCompleted ? '[x]' : '[ ]';
    const newSubIssueEntry = `   - ${checkbox} #${subIssueNumber}`;
    
    // Look for existing subtasks section
    const subtasksSectionRegex = /(## Subtasks\s*\n)((?:\s*-\s*\[[\sx]\]\s*#\d+.*\n?)*)/gmi;
    const match = subtasksSectionRegex.exec(body);
    
    if (match) {
      // Add to existing subtasks section
      const existingEntries = match[2];
      const updatedSection = `${match[1]}${existingEntries}${newSubIssueEntry}\n`;
      return body.replace(subtasksSectionRegex, updatedSection);
    } else {
      // Add new subtasks section before Meta section or at the end
      const metaSectionIndex = body.indexOf('## Meta');
      if (metaSectionIndex !== -1) {
        return body.slice(0, metaSectionIndex) + 
               `## Subtasks\n${newSubIssueEntry}\n\n` + 
               body.slice(metaSectionIndex);
      } else {
        return body + `\n## Subtasks\n${newSubIssueEntry}\n`;
      }
    }
  }

  /**
   * Add parent reference to sub-issue body
   */
  private addParentReferenceToBody(body: string, parentIssueNumber: number): string {
    // Check if parent reference already exists
    if (body.includes(`**Parent Task:** #${parentIssueNumber}`)) {
      return body;
    }
    
    // Look for existing Meta section
    const metaSectionRegex = /(## Meta\s*\n)/gmi;
    const match = metaSectionRegex.exec(body);
    
    if (match) {
      // Add parent reference in Meta section
      const parentRef = `- **Parent Task:** #${parentIssueNumber}\n`;
      return body.replace(metaSectionRegex, `${match[1]}${parentRef}`);
    } else {
      // Add new Meta section with parent reference
      return body + `\n## Meta\n- **Parent Task:** #${parentIssueNumber}\n`;
    }
  }

  /**
   * Remove a sub-issue relationship
   */
  async removeSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void> {
    return this.executeWithRetry(async () => {
      // Get both issues
      const [parentIssue, subIssue] = await Promise.all([
        this.octokit.issues.get({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: parentIssueNumber
        }),
        this.octokit.issues.get({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: subIssueNumber
        })
      ]);

      // Remove sub-issue reference from parent
      const updatedParentBody = this.removeSubIssueFromBody(
        parentIssue.data.body || '',
        subIssueNumber
      );

      // Remove parent reference from sub-issue
      const updatedSubIssueBody = this.removeParentReferenceFromBody(
        subIssue.data.body || '',
        parentIssueNumber
      );

      // Update both issues
      await Promise.all([
        this.octokit.issues.update({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: parentIssueNumber,
          body: updatedParentBody
        }),
        this.octokit.issues.update({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: subIssueNumber,
          body: updatedSubIssueBody
        })
      ]);

      this.log(`Removed sub-issue relationship: #${parentIssueNumber} -> #${subIssueNumber}`, 'info');
    }, 'remove-sub-issue', OperationPriority.HIGH);
  }

  /**
   * Remove sub-issue reference from parent issue body
   */
  private removeSubIssueFromBody(body: string, subIssueNumber: number): string {
    // Remove lines that reference the specific sub-issue
    const lines = body.split('\n');
    const filteredLines = lines.filter(line => 
      !line.includes(`#${subIssueNumber}`) || 
      !line.match(/^\s*-\s*\[[\sx]\]\s*#\d+/)
    );
    return filteredLines.join('\n');
  }

  /**
   * Remove parent reference from sub-issue body
   */
  private removeParentReferenceFromBody(body: string, parentIssueNumber: number): string {
    return body.replace(
      new RegExp(`- \\*\\*Parent Task:\\*\\* #${parentIssueNumber}\\n?`, 'g'),
      ''
    );
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitInfo> {
    if (this.rateLimitInfo) {
      return this.rateLimitInfo;
    }

    return this.executeWithRetry(async () => {
      const response = await this.octokit.rateLimit.get();
      const core = response.data.resources.core;
      
      const rateLimitInfo: RateLimitInfo = {
        remaining: core.remaining,
        limit: core.limit,
        reset: core.reset,
        isLimited: core.remaining === 0 && core.reset > Date.now() / 1000
      };

      this.rateLimitInfo = rateLimitInfo;
      return rateLimitInfo;
    }, 'rate-limit-check', OperationPriority.CRITICAL);
  }

  /**
   * Wait for all pending requests to complete
   */
  async waitForCompletion(): Promise<void> {
    while (this.requestQueue.length > 0 || this.activeRequests > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): { pending: number; active: number; rateLimited: boolean } {
    return {
      pending: this.requestQueue.length,
      active: this.activeRequests,
      rateLimited: this.rateLimitInfo?.isLimited || false
    };
  }

  /**
   * Get comprehensive error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerMetrics {
    return { ...this.circuitBreaker };
  }

  /**
   * Perform health check of the GitHub API client
   */
  async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const start = Date.now();
      await this.executeWithRetry(async () => {
        return await this.octokit.rateLimit.get();
      }, 'health-check', OperationPriority.CRITICAL);
      
      const responseTime = Date.now() - start;
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      
      return {
        healthy: true,
        details: {
          responseTime,
          circuitBreakerState: this.circuitBreaker.state,
          rateLimitInfo: this.rateLimitInfo,
          errorRate: this.calculateErrorRate(),
          lastCheck: this.lastHealthCheck
        }
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      
      return {
        healthy: false,
        details: {
          error: (error as Error).message,
          circuitBreakerState: this.circuitBreaker.state,
          lastFailure: this.circuitBreaker.lastFailureTime,
          lastCheck: this.lastHealthCheck
        }
      };
    }
  }

  /**
   * Calculate current error rate (errors per minute in last 10 minutes)
   */
  private calculateErrorRate(): number {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentErrors = this.errorMetrics.recentFailures.filter(
      failure => failure.timestamp > tenMinutesAgo
    );
    return recentErrors.length / 10; // errors per minute
  }

  /**
   * Reset circuit breaker manually (for administrative recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.state = CircuitBreakerState.CLOSED;
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.nextRetryTime = undefined;
    this.log('Circuit breaker manually reset', 'info');
  }

  /**
   * Clear error metrics (for administrative cleanup)
   */
  clearErrorMetrics(): void {
    this.errorMetrics = {
      total: 0,
      byCategory: {} as Record<GitHubErrorCategory, number>,
      byOperation: {},
      recentFailures: []
    };
    
    // Reinitialize all error categories
    Object.values(GitHubErrorCategory).forEach(category => {
      this.errorMetrics.byCategory[category] = 0;
    });
    
    this.log('Error metrics cleared', 'info');
  }

  /**
   * Calculate optimal batch size based on current conditions
   */
  private calculateOptimalBatchSize(operationType: string = 'default'): number {
    const batchConfig = this.config.batchConfig || {};
    const {
      enableAdaptiveBatching = true,
      minBatchSize = 5,
      maxBatchSize = 50,
      baseBatchSize = 15,
      rateLimitThreshold = 0.2,
      errorRateThreshold = 0.1
    } = batchConfig;

    if (!enableAdaptiveBatching) {
      return baseBatchSize;
    }

    let optimalSize = baseBatchSize;

    // Adjust based on rate limit status
    if (this.rateLimitInfo) {
      const rateLimitRatio = this.rateLimitInfo.remaining / this.rateLimitInfo.limit;
      
      if (rateLimitRatio < rateLimitThreshold) {
        // Low rate limit remaining, reduce batch size
        optimalSize = Math.max(minBatchSize, Math.floor(optimalSize * 0.5));
        this.log(`Reducing batch size to ${optimalSize} due to low rate limit (${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit})`, 'info');
      } else if (rateLimitRatio > 0.8) {
        // High rate limit available, can increase batch size
        optimalSize = Math.min(maxBatchSize, Math.floor(optimalSize * 1.5));
      }
    }

    // Adjust based on recent error rates
    const recentErrors = this.errorMetrics.recentFailures.filter(
      failure => Date.now() - failure.timestamp.getTime() < 300000 // Last 5 minutes
    );
    
    if (recentErrors.length > 0) {
      const errorRate = recentErrors.length / Math.max(1, this.errorMetrics.total);
      if (errorRate > errorRateThreshold) {
        optimalSize = Math.max(minBatchSize, Math.floor(optimalSize * 0.7));
        this.log(`Reducing batch size to ${optimalSize} due to high error rate (${(errorRate * 100).toFixed(1)}%)`, 'warn');
      }
    }

    // Adjust based on circuit breaker state
    if (this.circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      optimalSize = Math.max(minBatchSize, Math.floor(optimalSize * 0.3));
      this.log(`Reducing batch size to ${optimalSize} due to circuit breaker in half-open state`, 'warn');
    }

    return Math.max(minBatchSize, Math.min(maxBatchSize, optimalSize));
  }

  /**
   * Process items in optimized batches with adaptive sizing and retry logic
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      operationType?: string;
      priority?: OperationPriority;
      enableRetry?: boolean;
      enableCheckpointing?: boolean;
      checkpointCallback?: (checkpoint: ProcessingCheckpoint) => Promise<void>;
    } = {}
  ): Promise<BatchOperationResult<T>> {
    const {
      operationType = 'batch-operation',
      priority = OperationPriority.MEDIUM,
      enableRetry = true,
      enableCheckpointing = true,
      checkpointCallback
    } = options;

    const startTime = Date.now();
    const successful: Array<{ item: T; result: R }> = [];
    const failed: Array<{ item: T; error: GitHubApiError }> = [];
    
    let processedCount = 0;
    let currentBatchSize = this.calculateOptimalBatchSize(operationType);
    const checkpointInterval = this.config.batchConfig?.checkpointInterval || 100;

    this.log(`Starting batch processing of ${items.length} items with initial batch size ${currentBatchSize}`, 'info');

    for (let i = 0; i < items.length; i += currentBatchSize) {
      const batch = items.slice(i, i + currentBatchSize);
      const batchStartTime = Date.now();

      this.log(`Processing batch ${Math.floor(i / currentBatchSize) + 1}/${Math.ceil(items.length / currentBatchSize)} (${batch.length} items)`, 'debug');

      // Process batch items concurrently
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const result = await this.executeWithRetry(
              () => processor(item),
              operationType,
              priority
            );
            return { item, result };
          } catch (error) {
            // Convert to GitHubApiError if needed
            const apiError = error instanceof Error 
              ? this.categorizeError(error)
              : new Error(String(error)) as GitHubApiError;
            apiError.operation = operationType;
            throw { item, error: apiError };
          }
        })
      );

      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          const { item, error } = result.reason;
          failed.push({ item, error });
          
          // Log individual failures
          this.log(`Failed to process item: ${error.message}`, 'warn');
        }
      }

      processedCount += batch.length;

      // Update batch size based on performance
      const batchDuration = Date.now() - batchStartTime;
      const itemsPerSecond = batch.length / (batchDuration / 1000);
      
      if (itemsPerSecond < 1 && currentBatchSize > 5) {
        // Performance is poor, reduce batch size
        currentBatchSize = Math.max(5, Math.floor(currentBatchSize * 0.8));
        this.log(`Reducing batch size to ${currentBatchSize} due to poor performance (${itemsPerSecond.toFixed(2)} items/sec)`, 'info');
      } else if (itemsPerSecond > 3 && currentBatchSize < 50) {
        // Performance is good, can increase batch size
        currentBatchSize = Math.min(50, Math.floor(currentBatchSize * 1.2));
      }

      // Checkpointing
      if (enableCheckpointing && checkpointCallback && processedCount % checkpointInterval === 0) {
        const checkpoint: ProcessingCheckpoint = {
          totalItems: items.length,
          processedItems: processedCount,
          completedItems: successful.length,
          failedItems: failed.length,
          currentBatchSize,
          startTime: new Date(startTime),
          lastUpdateTime: new Date(),
          estimatedCompletionTime: this.estimateCompletionTime(startTime, processedCount, items.length)
        };

        try {
          await checkpointCallback(checkpoint);
          this.log(`Checkpoint saved: ${processedCount}/${items.length} items processed`, 'info');
        } catch (error) {
          this.log(`Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`, 'warn');
        }
      }

      // Rate limit protection between batches
      if (this.rateLimitInfo && this.rateLimitInfo.remaining < 10) {
        const waitTime = Math.min(60000, 5000 + Math.random() * 5000); // 5-10 seconds
        this.log(`Rate limit protection: waiting ${waitTime}ms before next batch`, 'info');
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    const totalTime = Date.now() - startTime;
    const operationsPerSecond = items.length / (totalTime / 1000);

    const metrics: BatchMetrics = {
      totalItems: items.length,
      successfulItems: successful.length,
      failedItems: failed.length,
      processingTimeMs: totalTime,
      batchSize: this.calculateOptimalBatchSize(operationType),
      batchCount: Math.ceil(items.length / currentBatchSize),
      operationsPerSecond,
      rateLimitInfo: this.rateLimitInfo || undefined
    };

    this.log(`Batch processing completed: ${successful.length}/${items.length} successful (${(successful.length / items.length * 100).toFixed(1)}%) in ${(totalTime / 1000).toFixed(2)}s`, 'info');

    return { successful, failed, metrics };
  }

  /**
   * Retry failed batch operations with exponential backoff
   */
  async retryFailedBatch<T, R>(
    failedItems: Array<{ item: T; error: GitHubApiError }>,
    processor: (item: T) => Promise<R>,
    options: {
      operationType?: string;
      priority?: OperationPriority;
      maxRetries?: number;
      backoffMultiplier?: number;
    } = {}
  ): Promise<BatchOperationResult<T>> {
    const {
      operationType = 'batch-retry',
      priority = OperationPriority.MEDIUM,
      maxRetries = 3,
      backoffMultiplier = 2
    } = options;

    const retryableItems = failedItems.filter(({ error }) => error.retryable);
    
    if (retryableItems.length === 0) {
      this.log('No retryable items found in failed batch', 'info');
      return {
        successful: [],
        failed: failedItems,
        metrics: {
          totalItems: failedItems.length,
          successfulItems: 0,
          failedItems: failedItems.length,
          processingTimeMs: 0,
          batchSize: 0,
          batchCount: 0,
          operationsPerSecond: 0
        }
      };
    }

    this.log(`Retrying ${retryableItems.length} failed items`, 'info');

    let attempt = 1;
    let remainingItems = retryableItems;
    const successful: Array<{ item: T; result: R }> = [];
    const finalFailed: Array<{ item: T; error: GitHubApiError }> = [];

    while (remainingItems.length > 0 && attempt <= maxRetries) {
      const backoffDelay = 1000 * Math.pow(backoffMultiplier, attempt - 1);
      
      if (attempt > 1) {
        this.log(`Waiting ${backoffDelay}ms before retry attempt ${attempt}`, 'info');
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }

      this.log(`Retry attempt ${attempt}/${maxRetries} for ${remainingItems.length} items`, 'info');

      const batchResult = await this.processBatch(
        remainingItems.map(({ item }) => item),
        processor,
        { operationType: `${operationType}-retry-${attempt}`, priority }
      );

      successful.push(...batchResult.successful);
      remainingItems = batchResult.failed;
      attempt++;
    }

    // Any remaining items are permanently failed
    finalFailed.push(...remainingItems);

    const totalItems = retryableItems.length;
    const metrics: BatchMetrics = {
      totalItems,
      successfulItems: successful.length,
      failedItems: finalFailed.length,
      processingTimeMs: 0, // Not tracked for retries
      batchSize: 0,
      batchCount: attempt - 1,
      operationsPerSecond: 0
    };

    this.log(`Batch retry completed: ${successful.length}/${totalItems} recovered after ${attempt - 1} attempts`, 'info');

    return { successful, failed: finalFailed, metrics };
  }

  /**
   * Estimate completion time based on current progress
   */
  private estimateCompletionTime(startTime: number, processedItems: number, totalItems: number): Date | undefined {
    if (processedItems === 0) return undefined;
    
    const elapsedTime = Date.now() - startTime;
    const averageTimePerItem = elapsedTime / processedItems;
    const remainingItems = totalItems - processedItems;
    const estimatedRemainingTime = remainingItems * averageTimePerItem;
    
    return new Date(Date.now() + estimatedRemainingTime);
  }

  /**
   * Enhanced logging helper with log levels
   */
  private log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'debug'): void {
    if (this.config.debug || level !== 'debug') {
      const timestamp = new Date().toISOString();
      const prefix = `[GitHubAPI:${level.toUpperCase()}] ${timestamp}`;
      
      switch (level) {
        case 'error':
          console.error(`${prefix} ${message}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${message}`);
          break;
        case 'info':
          console.info(`${prefix} ${message}`);
          break;
        default:
          console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Clean up timers and resources
   */
  destroy(): void {
    if (this.rateLimitResetTimer) {
      clearTimeout(this.rateLimitResetTimer);
      this.rateLimitResetTimer = null;
    }
    
    // Clear any pending timeouts in queue items
    this.requestQueue.forEach(item => {
      if (item.timeout) {
        clearTimeout(item.timeout);
      }
    });
    
    this.log('GitHub API client destroyed', 'info');
  }
}

/**
 * Factory function to create enhanced GitHub API client
 */
export function createGitHubApiClient(config: GitHubApiConfig): EnhancedGitHubApi {
  return new EnhancedGitHubApi(config);
}