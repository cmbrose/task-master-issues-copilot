/**
 * Taskmaster Breakdown Action
 * 
 * This action breaks down GitHub issues into sub-tasks via comment commands.
 * Triggered by issue comments starting with "/breakdown".
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { 
  loadConfig, 
  parseBreakdownCommand,
  createGitHubApiClient,
  EnhancedGitHubApi,
  createSubIssueFromTask,
  addSubIssueRelationship,
  updateIssueWithDependencies,
  updateBodyWithRequiredBy,
  updateDependencyLabels,
  ParentIssueStateManager,
  BreakdownStatus,
  type SubIssueTask as Task,
  type Issue,
  type ParentIssue,
  type BreakdownMetadata
} from '../../../scripts/index';

interface TaskGraph {
  tasks: Task[];
  metadata?: any;
}

/**
 * Get issue data using GitHub API
 */
async function getIssue(githubApi: EnhancedGitHubApi, issueNumber: number): Promise<Issue> {
  // Use octokit directly since getIssue doesn't exist yet
  const response = await (githubApi as any).octokit.issues.get({
    owner: (githubApi as any).config.owner,
    repo: (githubApi as any).config.repo,
    issue_number: issueNumber
  });
  
  return {
    ...response.data,
    expectedBody: response.data.body || ''
  };
}

/**
 * Simple task breakdown simulation for testing
 * In a real implementation, this would integrate with actual Taskmaster CLI
 */
function createMockTaskBreakdown(parentIssue: Issue, maxDepth: number, complexityThreshold: number): TaskGraph {
  // For now, create a simple breakdown of the parent issue
  const tasks: Task[] = [
    {
      id: 1,
      title: `Analysis and Planning for "${parentIssue.title}"`,
      description: `Analyze requirements and create implementation plan for the parent task.`,
      details: `Break down the parent issue into smaller, manageable components and define the implementation strategy.`,
      priority: 'high',
      status: 'pending',
      dependencies: []
    },
    {
      id: 2,
      title: `Implementation Phase 1`,
      description: `Implement the core functionality based on the analysis.`,
      details: `Focus on the main implementation work identified in the analysis phase.`,
      priority: 'medium',
      status: 'pending',
      dependencies: [1]
    },
    {
      id: 3,
      title: `Testing and Validation`,
      description: `Test the implementation and validate it meets requirements.`,
      details: `Create comprehensive tests and validate the solution works as expected.`,
      priority: 'medium',
      status: 'pending',
      dependencies: [2]
    }
  ];

  // Add required-by relationships
  for (const task of tasks) {
    task.requiredBy = tasks.filter(t => t.dependencies?.includes(task.id));
  }

  return {
    tasks,
    metadata: {
      parentIssue: parentIssue.number,
      breakdownDepth: maxDepth,
      complexityThreshold,
      generated: new Date().toISOString()
    }
  };
}

async function run(): Promise<void> {
  try {
    core.info('🔨 Starting Taskmaster Breakdown action');

    // Load configuration with priority: defaults < config files < env vars < action inputs
    const config = loadConfig(
      {
        validate: true,
        baseDir: process.cwd()
      },
      {
        // Action input overrides
        breakdownMaxDepth: core.getInput('breakdown-max-depth') ? 
          parseInt(core.getInput('breakdown-max-depth'), 10) : undefined,
        complexityThreshold: core.getInput('complexity-threshold') ? 
          parseInt(core.getInput('complexity-threshold'), 10) : undefined,
        taskmasterArgs: core.getInput('taskmaster-args') || undefined,
        githubToken: core.getInput('github-token') || undefined
      }
    );

    core.info(`📋 Configuration loaded:`);
    core.info(`  • Breakdown max depth: ${config.breakdownMaxDepth}`);
    core.info(`  • Complexity threshold: ${config.complexityThreshold}`);
    core.info(`  • Taskmaster args: ${config.taskmasterArgs || 'none'}`);

    // Step 1: Parse comment for breakdown command arguments
    const context = github.context;
    const payload = context.payload;
    
    // Validate that this is an issue comment event
    if (!payload.comment || !payload.issue) {
      throw new Error('This action must be triggered by an issue comment event');
    }
    
    const commentBody = payload.comment.body;
    const issueNumber = payload.issue.number;
    
    core.info(`📝 Processing comment on issue #${issueNumber}`);
    core.info(`💬 Comment body: ${commentBody}`);
    
    // Parse the breakdown command
    const parseResult = parseBreakdownCommand(commentBody);
    
    if (!parseResult.found) {
      core.setFailed('No breakdown command found in comment');
      return;
    }
    
    if (!parseResult.command || !parseResult.command.isValid) {
      const errors = parseResult.command?.errors || ['Unknown parsing error'];
      core.setFailed(`Invalid breakdown command: ${errors.join(', ')}`);
      return;
    }
    
    core.info(`✅ Valid breakdown command found`);
    core.info(`🔧 Command arguments: ${JSON.stringify(parseResult.command.args)}`);
    
    // Extract validated arguments
    const commandArgs = parseResult.validation?.normalized || {};
    const maxDepth = commandArgs.maxDepth || commandArgs.depth || config.breakdownMaxDepth || 2;
    const complexityThreshold = commandArgs.complexityThreshold || 
                               commandArgs.threshold || 
                               commandArgs.complexity || 
                               config.complexityThreshold || 40;
    
    core.info(`📊 Using max depth: ${maxDepth}`);
    core.info(`📈 Using complexity threshold: ${complexityThreshold}`);

    // Step 2: Fetch parent issue data and initialize state manager
    const githubApi = createGitHubApiClient({
      token: config.githubToken!,
      owner: context.repo.owner,
      repo: context.repo.repo,
      debug: true
    });

    // Initialize parent issue state manager
    const stateManager = new ParentIssueStateManager(githubApi);
    
    core.info(`🔍 Fetching parent issue #${issueNumber}...`);
    const parentIssueData = await getIssue(githubApi, issueNumber);
    const parentIssue: ParentIssue = {
      ...parentIssueData,
      subIssues: await githubApi.getSubIssues(issueNumber)
    };
    
    core.info(`📊 Parent issue: ${parentIssue.title}`);

    // Initialize breakdown state
    const breakdownMetadata: BreakdownMetadata = {
      executedAt: new Date(),
      maxDepth,
      complexityThreshold,
      commandArgs
    };
    
    await stateManager.initializeBreakdown(issueNumber, breakdownMetadata);
    core.info(`🚧 Initialized breakdown state for parent issue #${issueNumber}`);

    // Step 3: Generate task breakdown
    // Note: In a full implementation, this would run the actual Taskmaster CLI
    // For this implementation, we'll create a mock breakdown
    core.info(`🚀 Generating task breakdown...`);
    
    const taskGraph = createMockTaskBreakdown(parentIssue, maxDepth, complexityThreshold);
    
    if (!taskGraph.tasks || taskGraph.tasks.length === 0) {
      core.warning('No breakdown tasks generated');
      core.setOutput('sub-issues-created', '0');
      core.setOutput('parent-issue-updated', 'false');
      return;
    }
    
    core.info(`📋 Generated ${taskGraph.tasks.length} breakdown tasks`);

    // Step 4: Create sub-issues using GitHub API
    core.info(`🏗️ Creating sub-issues for breakdown...`);
    
    const createdSubIssues: Issue[] = [];
    const idToIssue: Record<string, Issue> = {};
    
    // Create sub-issues for each task
    for (const task of taskGraph.tasks) {
      try {
        const subIssue = await createSubIssueFromTask(
          githubApi,
          task,
          parentIssue,
          undefined, // No parent task for breakdown
          undefined  // No complexity score for mock breakdown
        );
        
        createdSubIssues.push(subIssue);
        idToIssue[String(task.id)] = subIssue;
        
        core.info(`✅ Created sub-issue #${subIssue.number}: ${task.title}`);
      } catch (error) {
        core.error(`❌ Failed to create sub-issue for task ${task.id}: ${error}`);
      }
    }

    // Step 5: Link sub-issues to parent via sub-issues API
    core.info(`🔗 Linking sub-issues to parent #${parentIssue.number}...`);
    
    for (const subIssue of createdSubIssues) {
      try {
        await addSubIssueRelationship(githubApi, parentIssue, subIssue);
      } catch (error) {
        core.warning(`Failed to link sub-issue #${subIssue.number}: ${error}`);
      }
    }

    // Update sub-issues with dependency relationships
    core.info(`🔄 Updating sub-issues with dependencies...`);
    for (const task of taskGraph.tasks) {
      const subIssue = idToIssue[String(task.id)];
      if (!subIssue) continue;

      // Update dependencies
      const depIssues = task.dependencies?.map(depId => idToIssue[String(depId)]).filter(Boolean);
      if (depIssues?.length) {
        subIssue.expectedBody = updateIssueWithDependencies(subIssue.expectedBody, depIssues);
      }

      // Update required-by relationships
      const reqByTasks = taskGraph.tasks.filter(t => t.dependencies?.includes(task.id));
      const reqByIssues = reqByTasks.map(t => idToIssue[String(t.id)]).filter(Boolean);
      if (reqByIssues?.length) {
        subIssue.expectedBody = updateBodyWithRequiredBy(subIssue.expectedBody, reqByIssues);
      }

      // Update labels based on dependency status
      const baseLabels = (subIssue.labels as any[])?.map(l => typeof l === 'string' ? l : l.name) || [];
      const dependencyLabels = updateDependencyLabels(task, depIssues);
      const updatedLabels = [...baseLabels, ...dependencyLabels];

      // Update the issue if needed
      if (subIssue.expectedBody !== subIssue.body || updatedLabels.length > baseLabels.length) {
        try {
          await githubApi.updateIssue(subIssue.number, {
            body: subIssue.expectedBody,
            labels: updatedLabels
          });
          core.info(`📝 Updated sub-issue #${subIssue.number} with dependencies and labels`);
        } catch (error) {
          core.warning(`Failed to update sub-issue #${subIssue.number}: ${error}`);
        }
      }
    }

    // Step 6: Complete breakdown and update parent issue state
    core.info(`📝 Completing breakdown for parent issue #${parentIssue.number}...`);
    
    const subIssueNumbers = createdSubIssues.map(issue => issue.number);
    await stateManager.completeBreakdown(parentIssue.number, subIssueNumbers);
    
    // Add breakdown summary section to body (legacy support)
    const breakdownSummary = `

## Breakdown Summary
Generated ${createdSubIssues.length} sub-issues from breakdown command:
${createdSubIssues.map(issue => `- [ ] #${issue.number} ${issue.title}`).join('\n')}

*Breakdown executed on ${new Date().toISOString()} with max-depth=${maxDepth}, complexity-threshold=${complexityThreshold}*
`;
    
    // Add breakdown summary to parent issue body if not already present
    const currentIssue = await githubApi.getIssue(parentIssue.number);
    let updatedParentBody = currentIssue.body || '';
    if (!updatedParentBody.includes('## Breakdown Summary')) {
      updatedParentBody += breakdownSummary;
      
      try {
        await githubApi.updateIssue(parentIssue.number, {
          body: updatedParentBody
        });
        core.info(`📝 Added breakdown summary to parent issue #${parentIssue.number}`);
      } catch (error) {
        core.warning(`Failed to update parent issue body: ${error}`);
      }
    }

    // Validate state consistency
    const consistencyCheck = await stateManager.validateStateConsistency(parentIssue.number);
    if (!consistencyCheck.isConsistent) {
      core.warning(`State consistency issues detected for parent #${parentIssue.number}:`);
      for (const issue of consistencyCheck.issues) {
        core.warning(`  - ${issue}`);
      }
    } else {
      core.info(`✅ Parent issue state is consistent`);
    }

    // Set outputs
    const parentState = stateManager.getState(parentIssue.number);
    core.setOutput('sub-issues-created', String(createdSubIssues.length));
    core.setOutput('parent-issue-updated', 'true');
    core.setOutput('parent-issue-state', parentState?.breakdownStatus || 'unknown');
    core.setOutput('parent-issue-progress', parentState ? `${parentState.completedSubIssues}/${parentState.totalSubIssues}` : '0/0');
    core.setOutput('state-consistency-check', consistencyCheck.isConsistent ? 'passed' : 'failed');
    core.setOutput('command-args', JSON.stringify(parseResult.command.args));
    core.setOutput('max-depth', maxDepth?.toString() || '');
    core.setOutput('complexity-threshold', complexityThreshold?.toString() || '');
    
    core.info(`✅ Taskmaster Breakdown completed successfully`);
    core.info(`🎯 Created ${createdSubIssues.length} sub-issues for issue #${parentIssue.number}`);
    
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();