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
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Enable structured error logging (default: true) */
  structuredLogging?: boolean;
  /** Enable error aggregation (default: true) */
  errorAggregation?: boolean;
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
  UNKNOWN = 'unknown'
}

/**
 * Circuit breaker states for API health management
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit open, requests failing fast
  HALF_OPEN = 'half_open' // Testing if service recovered
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
}

/**
 * Circuit breaker configuration and state
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit (default: 5) */
  failureThreshold: number;
  /** Success threshold to close circuit (default: 3) */
  successThreshold: number;
  /** Timeout before attempting half-open (default: 30000ms) */
  timeout: number;
}

/**
 * Error statistics for monitoring and alerting
 */
export interface ErrorStats {
  /** Total number of errors by category */
  errorsByCategory: Record<GitHubErrorCategory, number>;
  /** Recent error rate (errors per minute) */
  recentErrorRate: number;
  /** Last error timestamp */
  lastErrorTime: number;
  /** Consecutive failures count */
  consecutiveFailures: number;
  /** Total requests made */
  totalRequests: number;
  /** Success rate percentage */
  successRate: number;
}

/**
 * Health status of the API client
 */
export interface HealthStatus {
  /** Current circuit breaker state */
  circuitState: CircuitBreakerState;
  /** Whether API is currently healthy */
  isHealthy: boolean;
  /** Current rate limit status */
  rateLimitStatus: RateLimitInfo | null;
  /** Error statistics */
  errorStats: ErrorStats;
  /** Last successful request timestamp */
  lastSuccessTime: number;
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
  
  // Circuit breaker state
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private circuitBreakerConfig: Required<CircuitBreakerConfig>;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private circuitOpenTime = 0;
  
  // Error tracking and statistics
  private errorStats: ErrorStats = {
    errorsByCategory: {
      [GitHubErrorCategory.RATE_LIMITED]: 0,
      [GitHubErrorCategory.NETWORK]: 0,
      [GitHubErrorCategory.AUTH]: 0,
      [GitHubErrorCategory.NOT_FOUND]: 0,
      [GitHubErrorCategory.VALIDATION]: 0,
      [GitHubErrorCategory.SERVER]: 0,
      [GitHubErrorCategory.UNKNOWN]: 0
    },
    recentErrorRate: 0,
    lastErrorTime: 0,
    consecutiveFailures: 0,
    totalRequests: 0,
    successRate: 100
  };
  private lastSuccessTime = Date.now();
  
  // Error aggregation for structured logging
  private errorBuffer: Array<{
    timestamp: number;
    category: GitHubErrorCategory;
    message: string;
    operation: string;
    retryCount: number;
  }> = [];

  constructor(config: GitHubApiConfig) {
    const { circuitBreaker = {}, ...baseConfig } = config;
    
    this.config = {
      maxConcurrent: 3,
      retryDelay: 1000,
      maxRetries: 3,
      debug: false,
      structuredLogging: true,
      errorAggregation: true,
      circuitBreaker: {},
      ...baseConfig
    };

    // Initialize circuit breaker configuration
    this.circuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      ...circuitBreaker
    };

    this.octokit = new Octokit({ 
      auth: this.config.token,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          this.log(`Rate limit exceeded. Retrying after ${retryAfter} seconds`);
          return true; // Retry
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          this.log(`Secondary rate limit exceeded. Retrying after ${retryAfter} seconds`);
          return true; // Retry
        }
      }
    });

    // Start error aggregation if enabled
    if (this.config.errorAggregation) {
      this.startErrorAggregation();
    }
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
    category: string = 'general'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        operation,
        resolve,
        reject,
        retryCount: 0,
        category
      });
      this.processQueue();
    });
  }

  /**
   * Process the request queue with concurrency control and circuit breaker
   */
  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.config.maxConcurrent || this.requestQueue.length === 0) {
      return;
    }

    // Check circuit breaker state
    if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
      const timeSinceOpen = Date.now() - this.circuitOpenTime;
      if (timeSinceOpen < this.circuitBreakerConfig.timeout) {
        this.log(`Circuit breaker is OPEN. Failing fast for ${Math.ceil((this.circuitBreakerConfig.timeout - timeSinceOpen) / 1000)}s`);
        const item = this.requestQueue.shift();
        if (item) {
          const circuitError = new Error('Circuit breaker is open - API appears to be down') as GitHubApiError;
          circuitError.category = GitHubErrorCategory.SERVER;
          circuitError.retryable = false;
          item.reject(circuitError);
          this.recordError(circuitError, item.category, item.retryCount);
        }
        return;
      } else {
        // Transition to half-open to test if service recovered
        this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
        this.consecutiveSuccesses = 0;
        this.log('Circuit breaker transitioning to HALF_OPEN - testing service recovery');
      }
    }

    // Check if we're rate limited
    if (this.rateLimitInfo?.isLimited) {
      const waitTime = (this.rateLimitInfo.reset * 1000) - Date.now();
      if (waitTime > 0) {
        this.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds`);
        setTimeout(() => this.processQueue(), waitTime);
        return;
      }
    }

    const item = this.requestQueue.shift();
    if (!item) return;

    this.activeRequests++;
    this.errorStats.totalRequests++;
    
    try {
      const result = await this.executeOperation(item);
      this.recordSuccess(item.category);
      item.resolve(result);
    } catch (error) {
      const shouldRetry = await this.handleError(error as Error, item);
      if (shouldRetry) {
        this.requestQueue.unshift(item); // Retry at front of queue
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
    this.log(`Executing ${item.category} operation (attempt ${item.retryCount + 1})`);
    
    const result = await item.operation();
    
    // Update rate limit info if available in response headers
    if (result && typeof result === 'object' && 'headers' in result) {
      this.updateRateLimitInfo(result.headers);
    }
    
    return result;
  }

  /**
   * Handle API errors with categorization, retry logic, and circuit breaker
   */
  private async handleError(error: Error, item: QueueItem): Promise<boolean> {
    const apiError = this.categorizeError(error);
    
    // Record error for statistics and monitoring
    this.recordError(apiError, item.category, item.retryCount);
    
    this.log(`API error in ${item.category}: ${apiError.message} (category: ${apiError.category})`);

    // Update retry count
    item.retryCount++;

    // Check if we should retry based on error type and circuit breaker state
    if (!apiError.retryable || item.retryCount >= this.config.maxRetries) {
      this.log(`Not retrying ${item.category} after ${item.retryCount} attempts`);
      return false;
    }

    // In half-open state, be more conservative about retries
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN && 
        apiError.category !== GitHubErrorCategory.RATE_LIMITED) {
      this.log(`Circuit breaker is HALF_OPEN - not retrying ${item.category} to avoid reopening circuit`);
      return false;
    }

    // Calculate delay based on error type and retry count
    const delay = this.calculateRetryDelay(apiError, item.retryCount);
    this.log(`Retrying ${item.category} in ${delay}ms (attempt ${item.retryCount + 1})`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return true;
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

    if (apiError.status) {
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
          category = GitHubErrorCategory.NETWORK;
          retryable = true;
          break;
      }
    }

    return Object.assign(error, {
      category,
      status: apiError.status,
      rateLimitInfo,
      retryAfter,
      retryable
    }) as GitHubApiError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(error: GitHubApiError, retryCount: number): number {
    // Use specific retry-after header if available
    if (error.retryAfter) {
      return error.retryAfter;
    }

    // Rate limiting gets special treatment
    if (error.category === GitHubErrorCategory.RATE_LIMITED) {
      return Math.min(60000, this.config.retryDelay * Math.pow(2, retryCount)); // Max 1 minute
    }

    // Exponential backoff for other retryable errors
    const baseDelay = this.config.retryDelay;
    const jitter = Math.random() * 0.1 * baseDelay; // Add 10% jitter
    return Math.min(30000, baseDelay * Math.pow(2, retryCount) + jitter); // Max 30 seconds
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

    this.log(`Rate limit: ${remaining}/${limit} remaining, resets at ${new Date(reset * 1000).toISOString()}`);

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
    }, 'find-existing-issue');
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
      return response.data;
    }, 'create-issue');
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
      return response.data;
    }, 'update-issue');
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
      return response.data;
    }, 'list-issues');
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
    }, 'rate-limit-check');
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
  getQueueStatus(): { 
    pending: number; 
    active: number; 
    rateLimited: boolean;
    circuitState: CircuitBreakerState;
    consecutiveFailures: number;
    healthStatus: HealthStatus;
  } {
    return {
      pending: this.requestQueue.length,
      active: this.activeRequests,
      rateLimited: this.rateLimitInfo?.isLimited || false,
      circuitState: this.circuitBreakerState,
      consecutiveFailures: this.consecutiveFailures,
      healthStatus: this.getHealthStatus()
    };
  }

  /**
   * Internal logging helper
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[GitHubAPI] ${new Date().toISOString()} ${message}`);
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
  }

  /**
   * Record a successful operation and update circuit breaker state
   */
  private recordSuccess(category: string): void {
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;
    this.errorStats.consecutiveFailures = 0;
    
    // Update success rate
    const totalSuccesses = this.errorStats.totalRequests - Object.values(this.errorStats.errorsByCategory).reduce((a, b) => a + b, 0);
    this.errorStats.successRate = this.errorStats.totalRequests > 0 ? (totalSuccesses / this.errorStats.totalRequests) * 100 : 100;

    // Circuit breaker state management
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.circuitBreakerConfig.successThreshold) {
        this.circuitBreakerState = CircuitBreakerState.CLOSED;
        this.consecutiveSuccesses = 0;
        this.log('Circuit breaker closed - service recovered');
      }
    }

    this.log(`Successful ${category} operation - circuit state: ${this.circuitBreakerState}`);
  }

  /**
   * Record an error and update circuit breaker state
   */
  private recordError(error: GitHubApiError, category: string, retryCount: number): void {
    const now = Date.now();
    this.errorStats.lastErrorTime = now;
    this.errorStats.errorsByCategory[error.category]++;
    
    // Only count as consecutive failure if it's a final failure (not being retried)
    if (!error.retryable || retryCount >= this.config.maxRetries) {
      this.consecutiveFailures++;
      this.errorStats.consecutiveFailures++;
    }

    // Update error rate (errors per minute)
    const oneMinuteAgo = now - 60000;
    const recentErrors = this.errorBuffer.filter(e => e.timestamp > oneMinuteAgo).length;
    this.errorStats.recentErrorRate = recentErrors;

    // Update success rate
    const totalErrors = Object.values(this.errorStats.errorsByCategory).reduce((a, b) => a + b, 0);
    this.errorStats.successRate = this.errorStats.totalRequests > 0 ? ((this.errorStats.totalRequests - totalErrors) / this.errorStats.totalRequests) * 100 : 100;

    // Add to error buffer for aggregation
    if (this.config.errorAggregation) {
      this.errorBuffer.push({
        timestamp: now,
        category: error.category,
        message: error.message,
        operation: category,
        retryCount
      });
      
      // Keep only last 100 errors to prevent memory leak
      if (this.errorBuffer.length > 100) {
        this.errorBuffer = this.errorBuffer.slice(-100);
      }
    }

    // Circuit breaker logic for non-rate-limit errors
    if (error.category !== GitHubErrorCategory.RATE_LIMITED && 
        error.category !== GitHubErrorCategory.AUTH) {
      
      if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
        if (this.consecutiveFailures >= this.circuitBreakerConfig.failureThreshold) {
          this.circuitBreakerState = CircuitBreakerState.OPEN;
          this.circuitOpenTime = now;
          this.log(`Circuit breaker opened due to ${this.consecutiveFailures} consecutive failures`);
        }
      } else if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
        // Any failure in half-open state reopens the circuit
        this.circuitBreakerState = CircuitBreakerState.OPEN;
        this.circuitOpenTime = now;
        this.consecutiveSuccesses = 0;
        this.log('Circuit breaker reopened due to failure in half-open state');
      }
    }

    // Structured error logging
    if (this.config.structuredLogging) {
      this.logStructuredError(error, category, retryCount);
    }
  }

  /**
   * Log structured error information for monitoring
   */
  private logStructuredError(error: GitHubApiError, operation: string, retryCount: number): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'github-api',
      operation,
      error: {
        category: error.category,
        message: error.message,
        status: error.status,
        retryable: error.retryable,
        retryCount,
        stack: error.stack
      },
      circuitState: this.circuitBreakerState,
      consecutiveFailures: this.consecutiveFailures,
      rateLimited: this.rateLimitInfo?.isLimited || false
    };

    if (this.config.debug) {
      console.error(JSON.stringify(errorLog, null, 2));
    } else {
      console.error(JSON.stringify(errorLog));
    }
  }

  /**
   * Start error aggregation for periodic reporting
   */
  private startErrorAggregation(): void {
    setInterval(() => {
      if (this.errorBuffer.length > 0) {
        const oneMinuteAgo = Date.now() - 60000;
        const recentErrors = this.errorBuffer.filter(e => e.timestamp > oneMinuteAgo);
        
        if (recentErrors.length > 0) {
          const errorSummary = {
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'github-api-stats',
            recentErrorCount: recentErrors.length,
            errorsByCategory: recentErrors.reduce((acc, error) => {
              acc[error.category] = (acc[error.category] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            circuitState: this.circuitBreakerState,
            healthStatus: this.getHealthStatus()
          };

          if (this.config.debug) {
            console.log(JSON.stringify(errorSummary, null, 2));
          }
        }
      }
    }, 60000); // Report every minute
  }

  /**
   * Get comprehensive health status of the API client
   */
  getHealthStatus(): HealthStatus {
    const now = Date.now();
    const isHealthy = this.circuitBreakerState !== CircuitBreakerState.OPEN &&
                     this.errorStats.recentErrorRate < 10 &&
                     (now - this.lastSuccessTime) < 300000; // Last success within 5 minutes

    return {
      circuitState: this.circuitBreakerState,
      isHealthy,
      rateLimitStatus: this.rateLimitInfo,
      errorStats: { ...this.errorStats },
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Get recent error reports for debugging
   */
  getRecentErrors(minutes: number = 5): Array<{
    timestamp: number;
    category: GitHubErrorCategory;
    message: string;
    operation: string;
    retryCount: number;
  }> {
    const cutoff = Date.now() - (minutes * 60000);
    return this.errorBuffer.filter(error => error.timestamp > cutoff);
  }

  /**
   * Reset circuit breaker state manually (for testing or recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.circuitOpenTime = 0;
    this.log('Circuit breaker manually reset');
  }
}

/**
 * Factory function to create enhanced GitHub API client
 */
export function createGitHubApiClient(config: GitHubApiConfig): EnhancedGitHubApi {
  return new EnhancedGitHubApi(config);
}