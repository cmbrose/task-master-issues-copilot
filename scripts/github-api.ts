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

  constructor(config: GitHubApiConfig) {
    this.config = {
      maxConcurrent: 3,
      retryDelay: 1000,
      maxRetries: 3,
      debug: false,
      ...config
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
        this.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds`);
        setTimeout(() => this.processQueue(), waitTime);
        return;
      }
    }

    const item = this.requestQueue.shift();
    if (!item) return;

    this.activeRequests++;
    
    try {
      const result = await this.executeOperation(item);
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
   * Handle API errors with categorization and retry logic
   */
  private async handleError(error: Error, item: QueueItem): Promise<boolean> {
    const apiError = this.categorizeError(error);
    this.log(`API error in ${item.category}: ${apiError.message} (category: ${apiError.category})`);

    // Update retry count
    item.retryCount++;

    // Check if we should retry
    if (!apiError.retryable || item.retryCount >= this.config.maxRetries) {
      this.log(`Not retrying ${item.category} after ${item.retryCount} attempts`);
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
          subIssues.push(subIssue.data);
        } catch (error) {
          this.log(`Failed to fetch sub-issue #${subIssueNumber}: ${error}`);
        }
      }
      
      return subIssues;
    }, 'get-sub-issues');
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

      this.log(`Added sub-issue relationship: #${parentIssueNumber} -> #${subIssueNumber}`);
    }, 'add-sub-issue');
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

      this.log(`Removed sub-issue relationship: #${parentIssueNumber} -> #${subIssueNumber}`);
    }, 'remove-sub-issue');
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
  getQueueStatus(): { pending: number; active: number; rateLimited: boolean } {
    return {
      pending: this.requestQueue.length,
      active: this.activeRequests,
      rateLimited: this.rateLimitInfo?.isLimited || false
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
}

/**
 * Factory function to create enhanced GitHub API client
 */
export function createGitHubApiClient(config: GitHubApiConfig): EnhancedGitHubApi {
  return new EnhancedGitHubApi(config);
}