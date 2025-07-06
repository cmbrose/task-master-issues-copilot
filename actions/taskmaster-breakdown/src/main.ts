/**
 * Taskmaster Breakdown Action
 * 
 * This action breaks down GitHub issues into sub-tasks via comment commands.
 * Triggered by issue comments starting with "/breakdown".
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig, TaskmasterConfig, parseBreakdownCommand } from '../../../scripts/index';

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
    const maxDepth = commandArgs.maxDepth || commandArgs.depth || config.breakdownMaxDepth;
    const complexityThreshold = commandArgs.complexityThreshold || 
                               commandArgs.threshold || 
                               commandArgs.complexity || 
                               config.complexityThreshold;
    
    core.info(`📊 Using max depth: ${maxDepth}`);
    core.info(`📈 Using complexity threshold: ${complexityThreshold}`);

    // TODO: Continue with remaining steps
    // 2. Fetch parent issue YAML front-matter
    // 3. Run Taskmaster CLI on the specific node
    // 4. Create sub-issues using GitHub API
    // 5. Link sub-issues to parent via sub-issues API
    // 6. Close or convert parent issue
    // 7. React to comment with thumbs up

    core.setOutput('sub-issues-created', '0');
    core.setOutput('parent-issue-updated', 'false');
    core.setOutput('command-args', JSON.stringify(parseResult.command.args));
    core.setOutput('max-depth', maxDepth?.toString() || '');
    core.setOutput('complexity-threshold', complexityThreshold?.toString() || '');
    
    core.info('✅ Taskmaster Breakdown completed successfully');
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();