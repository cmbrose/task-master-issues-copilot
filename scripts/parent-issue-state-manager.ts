/**
 * Parent Issue State Manager
 * 
 * Comprehensive state management for parent issues with breakdown functionality:
 * - Dynamic status tracking based on sub-issue completion
 * - Comprehensive labeling system for breakdown progress
 * - State consistency validation across issue hierarchy
 * - Integration with idempotency framework
 */

import { EnhancedGitHubApi, ApiIssue } from './github-api';
import { IdempotencyManager } from './idempotency-manager';

export interface ParentIssueState {
  /** Issue number */
  issueNumber: number;
  /** Current breakdown status */
  breakdownStatus: BreakdownStatus;
  /** Sub-issue numbers */
  subIssueNumbers: number[];
  /** Completed sub-issue count */
  completedSubIssues: number;
  /** Total sub-issue count */
  totalSubIssues: number;
  /** Last state update timestamp */
  lastUpdated: Date;
  /** Breakdown execution metadata */
  breakdownMetadata?: BreakdownMetadata;
}

export interface BreakdownMetadata {
  /** When breakdown was executed */
  executedAt: Date;
  /** Max depth used */
  maxDepth?: number;
  /** Complexity threshold used */
  complexityThreshold?: number;
  /** Breakdown command arguments */
  commandArgs?: Record<string, any>;
}

export enum BreakdownStatus {
  /** No breakdown has been performed */
  NOT_BROKEN_DOWN = 'not-broken-down',
  /** Breakdown is in progress */
  BREAKDOWN_IN_PROGRESS = 'breakdown-in-progress', 
  /** Breakdown completed, sub-issues created */
  BREAKDOWN_COMPLETED = 'breakdown-completed',
  /** All sub-issues are completed */
  ALL_SUBTASKS_COMPLETED = 'all-subtasks-completed',
  /** Breakdown failed */
  BREAKDOWN_FAILED = 'breakdown-failed'
}

export class ParentIssueStateManager {
  private githubApi: EnhancedGitHubApi;
  private idempotencyManager?: IdempotencyManager;
  private stateCache: Map<number, ParentIssueState> = new Map();

  constructor(githubApi: EnhancedGitHubApi, idempotencyManager?: IdempotencyManager) {
    this.githubApi = githubApi;
    this.idempotencyManager = idempotencyManager;
  }

  /**
   * Initialize breakdown for a parent issue
   */
  async initializeBreakdown(
    parentIssueNumber: number,
    breakdownMetadata: BreakdownMetadata
  ): Promise<void> {
    const state: ParentIssueState = {
      issueNumber: parentIssueNumber,
      breakdownStatus: BreakdownStatus.BREAKDOWN_IN_PROGRESS,
      subIssueNumbers: [],
      completedSubIssues: 0,
      totalSubIssues: 0,
      lastUpdated: new Date(),
      breakdownMetadata
    };

    this.stateCache.set(parentIssueNumber, state);
    
    // Update issue labels to reflect breakdown in progress
    await this.updateIssueLabels(parentIssueNumber, state);
    
    // Record state in idempotency manager if available
    if (this.idempotencyManager) {
      this.idempotencyManager.recordIssueUpdate(
        parentIssueNumber,
        undefined,
        this.generateLabelsForState(state)
      );
    }
  }

  /**
   * Complete breakdown and update parent issue state
   */
  async completeBreakdown(
    parentIssueNumber: number,
    subIssueNumbers: number[]
  ): Promise<void> {
    const state = this.stateCache.get(parentIssueNumber);
    if (!state) {
      throw new Error(`Parent issue state not found for #${parentIssueNumber}`);
    }

    // Count completed sub-issues
    const completedCount = await this.countCompletedSubIssues(subIssueNumbers);
    
    state.breakdownStatus = BreakdownStatus.BREAKDOWN_COMPLETED;
    state.subIssueNumbers = subIssueNumbers;
    state.totalSubIssues = subIssueNumbers.length;
    state.completedSubIssues = completedCount;
    state.lastUpdated = new Date();

    // Check if all sub-issues are already completed
    if (completedCount === subIssueNumbers.length && subIssueNumbers.length > 0) {
      state.breakdownStatus = BreakdownStatus.ALL_SUBTASKS_COMPLETED;
    }

    this.stateCache.set(parentIssueNumber, state);
    
    // Update issue labels and body
    await this.updateIssueLabels(parentIssueNumber, state);
    await this.updateIssueBody(parentIssueNumber, state);
    
    // Record state in idempotency manager if available
    if (this.idempotencyManager) {
      this.idempotencyManager.recordIssueUpdate(
        parentIssueNumber,
        undefined,
        this.generateLabelsForState(state)
      );
    }
  }

  /**
   * Update parent issue state when sub-issue states change
   */
  async updateFromSubIssueChange(
    subIssueNumber: number,
    newState: 'open' | 'closed'
  ): Promise<void> {
    // Find parent issues that contain this sub-issue
    const parentIssues = await this.findParentIssues(subIssueNumber);
    
    for (const parentIssue of parentIssues) {
      await this.refreshParentState(parentIssue.number);
    }
  }

  /**
   * Refresh parent issue state by checking current sub-issue states
   */
  async refreshParentState(parentIssueNumber: number): Promise<void> {
    let state = this.stateCache.get(parentIssueNumber);
    
    if (!state) {
      // Load state from issue if not in cache
      const loadedState = await this.loadStateFromIssue(parentIssueNumber);
      if (!loadedState) return; // Not a breakdown issue
      state = loadedState;
    }

    const prevCompletedCount = state.completedSubIssues;
    const currentCompletedCount = await this.countCompletedSubIssues(state.subIssueNumbers);
    
    state.completedSubIssues = currentCompletedCount;
    state.lastUpdated = new Date();

    // Update breakdown status based on completion
    const prevStatus = state.breakdownStatus;
    if (currentCompletedCount === state.totalSubIssues && state.totalSubIssues > 0) {
      state.breakdownStatus = BreakdownStatus.ALL_SUBTASKS_COMPLETED;
    } else if (state.breakdownStatus === BreakdownStatus.ALL_SUBTASKS_COMPLETED) {
      // Some sub-issues were reopened
      state.breakdownStatus = BreakdownStatus.BREAKDOWN_COMPLETED;
    }

    // Only update if state actually changed
    if (prevCompletedCount !== currentCompletedCount || prevStatus !== state.breakdownStatus) {
      this.stateCache.set(parentIssueNumber, state);
      await this.updateIssueLabels(parentIssueNumber, state);
      
      // Record state change in idempotency manager if available
      if (this.idempotencyManager) {
        this.idempotencyManager.recordIssueUpdate(
          parentIssueNumber,
          undefined,
          this.generateLabelsForState(state)
        );
      }
    }
  }

  /**
   * Validate state consistency across parent-child relationships
   */
  async validateStateConsistency(parentIssueNumber: number): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    const state = this.stateCache.get(parentIssueNumber);
    if (!state) {
      return { isConsistent: true, issues: [] };
    }

    const issues: string[] = [];
    
    // Check if all sub-issues still exist and are properly linked
    for (const subIssueNumber of state.subIssueNumbers) {
      try {
        const subIssue = await this.githubApi.getIssue(subIssueNumber);
        
        // Check if sub-issue still references this parent
        if (!this.isSubIssueLinkedToParent(subIssue, parentIssueNumber)) {
          issues.push(`Sub-issue #${subIssueNumber} is not properly linked to parent #${parentIssueNumber}`);
        }
      } catch (error) {
        issues.push(`Sub-issue #${subIssueNumber} could not be found or accessed`);
      }
    }

    // Check if sub-issue API relationships are maintained
    try {
      const apiSubIssues = await this.githubApi.getSubIssues(parentIssueNumber);
      const apiSubIssueNumbers = apiSubIssues.map(issue => issue.number);
      
      // Check for discrepancies
      const missingFromApi = state.subIssueNumbers.filter(num => !apiSubIssueNumbers.includes(num));
      const extraInApi = apiSubIssueNumbers.filter(num => !state.subIssueNumbers.includes(num));
      
      if (missingFromApi.length > 0) {
        issues.push(`Sub-issues missing from API: ${missingFromApi.join(', ')}`);
      }
      if (extraInApi.length > 0) {
        issues.push(`Extra sub-issues in API: ${extraInApi.join(', ')}`);
      }
    } catch (error) {
      issues.push(`Could not verify sub-issues API relationships: ${error}`);
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  /**
   * Get current state for a parent issue
   */
  getState(parentIssueNumber: number): ParentIssueState | undefined {
    return this.stateCache.get(parentIssueNumber);
  }

  /**
   * Export state for persistence/debugging
   */
  exportState(): Record<number, ParentIssueState> {
    const exported: Record<number, ParentIssueState> = {};
    for (const [issueNumber, state] of this.stateCache.entries()) {
      exported[issueNumber] = { ...state };
    }
    return exported;
  }

  // Private helper methods

  private async countCompletedSubIssues(subIssueNumbers: number[]): Promise<number> {
    let completedCount = 0;
    
    for (const subIssueNumber of subIssueNumbers) {
      try {
        const subIssue = await this.githubApi.getIssue(subIssueNumber);
        if (subIssue.state === 'closed') {
          completedCount++;
        }
      } catch (error) {
        // If sub-issue can't be accessed, don't count it
        console.warn(`Could not access sub-issue #${subIssueNumber}: ${error}`);
      }
    }
    
    return completedCount;
  }

  private async findParentIssues(subIssueNumber: number): Promise<ApiIssue[]> {
    // This is a simplified implementation
    // In a full implementation, you would search for issues that have this sub-issue
    // or use the sub-issues API to find parent relationships
    return [];
  }

  private async loadStateFromIssue(parentIssueNumber: number): Promise<ParentIssueState | null> {
    try {
      const issue = await this.githubApi.getIssue(parentIssueNumber);
      
      // Check if this is a breakdown issue by looking for breakdown labels
      const labels = issue.labels?.map(label => 
        typeof label === 'string' ? label : label.name
      ) || [];
      
      if (!labels.includes('breakdown-completed') && !labels.includes('breakdown-in-progress')) {
        return null; // Not a breakdown issue
      }
      
      // Try to extract sub-issue numbers from breakdown summary in body
      const subIssueNumbers = this.extractSubIssueNumbers(issue.body || '');
      const completedCount = await this.countCompletedSubIssues(subIssueNumbers);
      
      // Determine breakdown status from labels
      let breakdownStatus = BreakdownStatus.NOT_BROKEN_DOWN;
      if (labels.includes('all-subtasks-completed')) {
        breakdownStatus = BreakdownStatus.ALL_SUBTASKS_COMPLETED;
      } else if (labels.includes('breakdown-completed')) {
        breakdownStatus = BreakdownStatus.BREAKDOWN_COMPLETED;
      } else if (labels.includes('breakdown-in-progress')) {
        breakdownStatus = BreakdownStatus.BREAKDOWN_IN_PROGRESS;
      }
      
      return {
        issueNumber: parentIssueNumber,
        breakdownStatus,
        subIssueNumbers,
        completedSubIssues: completedCount,
        totalSubIssues: subIssueNumbers.length,
        lastUpdated: new Date(issue.updated_at || Date.now())
      };
    } catch (error) {
      console.warn(`Could not load state from issue #${parentIssueNumber}: ${error}`);
      return null;
    }
  }

  private extractSubIssueNumbers(issueBody: string): number[] {
    const subIssueNumbers: number[] = [];
    
    // Look for breakdown summary section and extract issue numbers
    const breakdownMatch = issueBody.match(/## Breakdown Summary[\s\S]*?(?=\n##|\n\*|$)/);
    if (breakdownMatch) {
      const matches = breakdownMatch[0].match(/#(\d+)/g);
      if (matches) {
        for (const match of matches) {
          const issueNumber = parseInt(match.substring(1));
          if (!isNaN(issueNumber)) {
            subIssueNumbers.push(issueNumber);
          }
        }
      }
    }
    
    return subIssueNumbers;
  }

  private isSubIssueLinkedToParent(subIssue: ApiIssue, parentIssueNumber: number): boolean {
    // Check if sub-issue body contains reference to parent
    const body = subIssue.body || '';
    return body.includes(`**Parent Task:** #${parentIssueNumber}`) ||
           body.includes(`Parent: #${parentIssueNumber}`);
  }

  private async updateIssueLabels(parentIssueNumber: number, state: ParentIssueState): Promise<void> {
    try {
      const issue = await this.githubApi.getIssue(parentIssueNumber);
      const currentLabels = issue.labels?.map(label => 
        typeof label === 'string' ? label : label.name
      ) || [];
      
      const newLabels = this.generateLabelsForState(state);
      
      // Merge with existing non-breakdown labels
      const preservedLabels = currentLabels.filter(label => 
        label && !this.isBreakdownLabel(label)
      );
      
      const finalLabels = [...preservedLabels, ...newLabels];
      
      await this.githubApi.updateIssue(parentIssueNumber, {
        labels: finalLabels.filter((label): label is string => label !== undefined)
      });
    } catch (error) {
      console.warn(`Could not update labels for parent issue #${parentIssueNumber}: ${error}`);
    }
  }

  private async updateIssueBody(parentIssueNumber: number, state: ParentIssueState): Promise<void> {
    if (!state.breakdownMetadata) return;
    
    try {
      const issue = await this.githubApi.getIssue(parentIssueNumber);
      let body = issue.body || '';
      
      // Generate status section
      const statusSection = this.generateStatusSection(state);
      
      // Add or update status section
      if (body.includes('## Breakdown Status')) {
        body = body.replace(
          /## Breakdown Status[\s\S]*?(?=\n##|\n\*|$)/,
          statusSection
        );
      } else {
        // Insert before breakdown summary if it exists, otherwise append
        if (body.includes('## Breakdown Summary')) {
          body = body.replace(
            '## Breakdown Summary',
            `${statusSection}\n\n## Breakdown Summary`
          );
        } else {
          body += `\n\n${statusSection}`;
        }
      }
      
      await this.githubApi.updateIssue(parentIssueNumber, {
        body
      });
    } catch (error) {
      console.warn(`Could not update body for parent issue #${parentIssueNumber}: ${error}`);
    }
  }

  private generateLabelsForState(state: ParentIssueState): string[] {
    const labels: string[] = [];
    
    switch (state.breakdownStatus) {
      case BreakdownStatus.BREAKDOWN_IN_PROGRESS:
        labels.push('breakdown-in-progress');
        break;
      case BreakdownStatus.BREAKDOWN_COMPLETED:
        labels.push('breakdown-completed');
        if (state.totalSubIssues > 0) {
          labels.push('has-subtasks');
          if (state.completedSubIssues > 0) {
            labels.push(`subtasks-completed:${state.completedSubIssues}`);
          }
          if (state.completedSubIssues < state.totalSubIssues) {
            labels.push('has-open-subtasks');
          }
        }
        break;
      case BreakdownStatus.ALL_SUBTASKS_COMPLETED:
        labels.push('breakdown-completed');
        labels.push('all-subtasks-completed');
        labels.push('has-subtasks');
        break;
      case BreakdownStatus.BREAKDOWN_FAILED:
        labels.push('breakdown-failed');
        break;
    }
    
    return labels;
  }

  private generateStatusSection(state: ParentIssueState): string {
    const completionPercentage = state.totalSubIssues > 0 
      ? Math.round((state.completedSubIssues / state.totalSubIssues) * 100)
      : 0;
    
    let statusEmoji = '⏳';
    let statusText = 'In Progress';
    
    switch (state.breakdownStatus) {
      case BreakdownStatus.BREAKDOWN_IN_PROGRESS:
        statusEmoji = '🚧';
        statusText = 'Breakdown In Progress';
        break;
      case BreakdownStatus.ALL_SUBTASKS_COMPLETED:
        statusEmoji = '✅';
        statusText = 'All Subtasks Completed';
        break;
      case BreakdownStatus.BREAKDOWN_FAILED:
        statusEmoji = '❌';
        statusText = 'Breakdown Failed';
        break;
    }
    
    return `## Breakdown Status
${statusEmoji} **${statusText}**

**Progress:** ${state.completedSubIssues}/${state.totalSubIssues} subtasks completed (${completionPercentage}%)  
**Last Updated:** ${state.lastUpdated.toISOString()}`;
  }

  private isBreakdownLabel(label: string): boolean {
    const breakdownLabels = [
      'breakdown-in-progress',
      'breakdown-completed', 
      'breakdown-failed',
      'all-subtasks-completed',
      'has-subtasks',
      'has-open-subtasks'
    ];
    
    return breakdownLabels.includes(label) || 
           label.startsWith('subtasks-completed:');
  }
}