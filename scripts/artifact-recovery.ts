/**
 * Artifact Recovery Script for Task Graph Replay
 * 
 * Provides functionality to:
 * - Download and validate artifacts by URL/ID
 * - Recreate issues idempotently from artifact data
 * - Log structured recovery process information
 * - Handle errors gracefully with detailed reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import { ArtifactManager, TaskGraphArtifact } from './artifact-manager';
import { EnhancedGitHubApi, GitHubApiConfig } from './github-api';
import * as core from '@actions/core';

/**
 * Recovery configuration options
 */
export interface RecoveryConfig {
  /** Artifact ID or URL to recover from */
  artifactId: string;
  /** GitHub token for API access */
  githubToken: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Dry run mode - don't create actual issues */
  dryRun?: boolean;
  /** Force recreation even if issues exist */
  forceRecreate?: boolean;
  /** Maximum number of issues to create in one run */
  maxIssues?: number;
}

/**
 * Recovery result information
 */
export interface RecoveryResult {
  /** Success status */
  success: boolean;
  /** Artifact information */
  artifact?: TaskGraphArtifact;
  /** Number of issues created */
  issuesCreated: number;
  /** Number of issues updated */
  issuesUpdated: number;
  /** Number of issues skipped */
  issuesSkipped: number;
  /** Errors encountered */
  errors: string[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Main artifact recovery class
 */
export class ArtifactRecovery {
  private artifactManager: ArtifactManager;
  private githubApi: EnhancedGitHubApi;
  private config: RecoveryConfig;

  constructor(config: RecoveryConfig) {
    this.config = config;
    this.artifactManager = new ArtifactManager();
    this.githubApi = new EnhancedGitHubApi({
      token: config.githubToken,
      owner: config.owner,
      repo: config.repo,
      debug: true
    });
  }

  /**
   * Execute the artifact recovery process
   */
  async recover(): Promise<RecoveryResult> {
    const startTime = Date.now();
    const result: RecoveryResult = {
      success: false,
      issuesCreated: 0,
      issuesUpdated: 0,
      issuesSkipped: 0,
      errors: [],
      processingTimeMs: 0
    };

    try {
      console.log(`🚀 Starting artifact recovery for ID: ${this.config.artifactId}`);
      
      if (this.config.dryRun) {
        console.log(`🎯 DRY-RUN MODE: No issues will be created or modified`);
      }

      // Step 1: Download and validate artifact
      console.log(`📦 Step 1: Downloading artifact...`);
      const artifact = await this.artifactManager.downloadArtifact(this.config.artifactId);
      
      if (!artifact) {
        throw new Error(`Failed to download or validate artifact: ${this.config.artifactId}`);
      }

      result.artifact = artifact;
      console.log(`✅ Artifact downloaded successfully`);
      console.log(`   - Total tasks: ${artifact.metadata.totalTasks}`);
      console.log(`   - PRD hash: ${artifact.metadata.prdHash}`);
      console.log(`   - Original workflow: ${artifact.metadata.workflowRunContext.workflowName}`);

      // Step 2: Check for existing issues
      console.log(`🔍 Step 2: Checking for existing issues...`);
      const existingIssues = await this.findExistingIssues(artifact);
      console.log(`   - Found ${existingIssues.length} existing issues`);

      // Step 3: Process task graph and create/update issues
      console.log(`⚙️ Step 3: Processing task graph...`);
      await this.processTaskGraph(artifact, existingIssues, result);

      result.success = true;
      console.log(`✅ Artifact recovery completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      console.error(`❌ Artifact recovery failed: ${errorMessage}`);
    } finally {
      result.processingTimeMs = Date.now() - startTime;
      this.cleanup();
    }

    return result;
  }

  /**
   * Find existing issues that match the task graph
   */
  private async findExistingIssues(artifact: TaskGraphArtifact): Promise<any[]> {
    try {
      // Search for issues that might have been created from this task graph
      // Look for issues with specific labels or content patterns
      const issues = await this.githubApi.listIssues({
        labels: 'taskmaster',
        state: 'all'
      });

      const matchingIssues = issues.filter(issue => {
        // Check if issue body contains metadata that matches our artifact
        if (!issue.body) return false;
        
        // Look for YAML front-matter or specific task identifiers
        return issue.body.includes('taskmaster') || 
               issue.body.includes(artifact.metadata.prdHash) ||
               issue.title.toLowerCase().includes('task');
      });

      return matchingIssues;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch existing issues: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Process the task graph and create/update issues
   */
  private async processTaskGraph(
    artifact: TaskGraphArtifact, 
    existingIssues: any[], 
    result: RecoveryResult
  ): Promise<void> {
    if (!artifact.taskGraph.tasks || !Array.isArray(artifact.taskGraph.tasks)) {
      throw new Error('Invalid task graph structure - no tasks array found');
    }

    let issueCount = 0;
    const maxIssues = this.config.maxIssues || 50;

    await this.processTasksRecursively(
      artifact.taskGraph.tasks,
      existingIssues,
      result,
      issueCount,
      maxIssues
    );
  }

  /**
   * Process tasks recursively to create issues
   */
  private async processTasksRecursively(
    tasks: any[],
    existingIssues: any[],
    result: RecoveryResult,
    issueCount: number,
    maxIssues: number,
    parentIssueNumber?: number
  ): Promise<void> {
    for (const task of tasks) {
      if (issueCount >= maxIssues) {
        console.log(`⚠️ Reached maximum issue limit (${maxIssues}), stopping`);
        break;
      }

      try {
        // Check if this task already has a corresponding issue
        const existingIssue = this.findMatchingIssue(task, existingIssues);
        
        if (existingIssue && !this.config.forceRecreate) {
          console.log(`⏭️ Skipping existing issue: ${existingIssue.title}`);
          result.issuesSkipped++;
          continue;
        }

        if (this.config.dryRun) {
          console.log(`🎯 DRY-RUN: Would create issue for task: ${task.title || task.description || 'Untitled'}`);
          result.issuesCreated++;
        } else {
          // Create the issue
          const issue = await this.createIssueFromTask(task, parentIssueNumber);
          
          if (issue) {
            console.log(`✅ Created issue #${issue.number}: ${issue.title}`);
            result.issuesCreated++;
            issueCount++;

            // Process subtasks if they exist
            if (task.subtasks && Array.isArray(task.subtasks)) {
              await this.processTasksRecursively(
                task.subtasks,
                existingIssues,
                result,
                issueCount,
                maxIssues,
                issue.number
              );
            }
          }
        }
      } catch (error) {
        const errorMessage = `Failed to process task "${task.title}": ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }
  }

  /**
   * Find matching issue for a task
   */
  private findMatchingIssue(task: any, existingIssues: any[]): any | null {
    const taskTitle = task.title || task.description || '';
    
    return existingIssues.find(issue => {
      // Simple matching by title similarity
      return issue.title.toLowerCase().includes(taskTitle.toLowerCase()) ||
             taskTitle.toLowerCase().includes(issue.title.toLowerCase());
    }) || null;
  }

  /**
   * Create GitHub issue from task data
   */
  private async createIssueFromTask(task: any, parentIssueNumber?: number): Promise<any> {
    const title = task.title || task.description || 'Recovered Task';
    const body = this.generateIssueBody(task, parentIssueNumber);
    const labels = ['taskmaster', 'recovered'];

    // Add complexity label if available
    if (task.complexity) {
      labels.push(`complexity-${task.complexity}`);
    }

    // Add status labels
    if (task.blocked || task.status === 'blocked') {
      labels.push('blocked');
    }

    const issueData = {
      title,
      body,
      labels
    };

    const issue = await this.githubApi.createIssue(issueData);
    
    // If this is a subtask, link it to the parent
    if (parentIssueNumber && issue) {
      try {
        await this.linkToParentIssue(issue.number, parentIssueNumber);
      } catch (error) {
        console.warn(`⚠️ Failed to link issue #${issue.number} to parent #${parentIssueNumber}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return issue;
  }

  /**
   * Generate issue body from task data
   */
  private generateIssueBody(task: any, parentIssueNumber?: number): string {
    let body = '## Details\n\n';
    
    if (task.description) {
      body += `${task.description}\n\n`;
    }

    if (task.requirements && Array.isArray(task.requirements)) {
      body += '### Requirements\n\n';
      for (const req of task.requirements) {
        body += `- ${req}\n`;
      }
      body += '\n';
    }

    if (task.dependencies && Array.isArray(task.dependencies)) {
      body += '### Dependencies\n\n';
      for (const dep of task.dependencies) {
        body += `- ${dep}\n`;
      }
      body += '\n';
    }

    // Add recovery metadata
    body += '## Recovery Metadata\n\n';
    body += `- **Recovered**: ${new Date().toISOString()}\n`;
    body += `- **Original Artifact**: ${this.config.artifactId}\n`;
    
    if (parentIssueNumber) {
      body += `- **Parent Issue**: #${parentIssueNumber}\n`;
    }

    if (task.complexity) {
      body += `- **Complexity**: ${task.complexity}/10\n`;
    }

    return body;
  }

  /**
   * Link issue to parent (using sub-issues if available)
   */
  private async linkToParentIssue(issueNumber: number, parentIssueNumber: number): Promise<void> {
    try {
      // For now, we'll include the parent relationship in the issue body
      // In a more complete implementation, this would use the sub-issues API
      console.log(`🔗 Linking issue #${issueNumber} to parent #${parentIssueNumber}`);
      
      // The relationship is already established in the issue body via generateIssueBody
      // Additional linking could be implemented here if sub-issues API is available
      
    } catch (error) {
      // Non-critical error, just log it
      console.warn(`⚠️ Failed to link issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean up temporary resources
   */
  private cleanup(): void {
    try {
      this.artifactManager.cleanup();
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Main entry point for artifact recovery
 */
export async function recoverFromArtifact(config: RecoveryConfig): Promise<RecoveryResult> {
  const recovery = new ArtifactRecovery(config);
  return await recovery.recover();
}

/**
 * CLI entry point when run directly
 */
if (require.main === module) {
  const artifactId = process.env.ARTIFACT_ID || process.argv[2];
  const githubToken = process.env.GITHUB_TOKEN || '';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repository.split('/');

  if (!artifactId || !githubToken || !owner || !repo) {
    console.error('❌ Missing required parameters:');
    console.error('   ARTIFACT_ID or command line argument');
    console.error('   GITHUB_TOKEN environment variable');
    console.error('   GITHUB_REPOSITORY environment variable');
    process.exit(1);
  }

  const config: RecoveryConfig = {
    artifactId,
    githubToken,
    owner,
    repo,
    dryRun: process.env.DRY_RUN === 'true',
    forceRecreate: process.env.FORCE_RECREATE === 'true',
    maxIssues: parseInt(process.env.MAX_ISSUES || '50')
  };

  recoverFromArtifact(config)
    .then(result => {
      console.log('\n📊 Recovery Summary:');
      console.log(`   - Success: ${result.success}`);
      console.log(`   - Issues created: ${result.issuesCreated}`);
      console.log(`   - Issues updated: ${result.issuesUpdated}`);
      console.log(`   - Issues skipped: ${result.issuesSkipped}`);
      console.log(`   - Errors: ${result.errors.length}`);
      console.log(`   - Processing time: ${(result.processingTimeMs / 1000).toFixed(2)}s`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        result.errors.forEach(error => console.log(`   - ${error}`));
      }

      // Set GitHub Actions outputs
      if (process.env.GITHUB_ACTIONS === 'true') {
        core.setOutput('success', result.success.toString());
        core.setOutput('issues-created', result.issuesCreated.toString());
        core.setOutput('issues-updated', result.issuesUpdated.toString());
        core.setOutput('issues-skipped', result.issuesSkipped.toString());
        core.setOutput('errors', result.errors.length.toString());
        core.setOutput('processing-time-ms', result.processingTimeMs.toString());
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error(`💥 Fatal error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}