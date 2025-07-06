#!/usr/bin/env ts-node

/**
 * Integration example showing how the metadata extractor works with existing parsers
 */

import { createGitHubApiClient } from '../scripts/github-api';
import { createMetadataExtractor, IssueMetadata } from '../scripts/metadata-extractor';
import { parseIssueBody } from '../scripts/issue-parser';
import { parseBreakdownCommand } from '../scripts/comment-parser';

function demonstrateIntegration() {
  console.log('🔗 Demonstrating Metadata Extractor Integration\n');
  
  // Example: Complete command execution workflow
  console.log('⚙️ Complete Breakdown Command Execution Workflow');
  console.log('```typescript');
  console.log(`import { createGitHubApiClient, createMetadataExtractor } from './scripts';
import { parseIssueBody } from './scripts/issue-parser';
import { parseBreakdownCommand } from './scripts/comment-parser';

/**
 * Complete workflow for executing a breakdown command
 */
async function executeBreakdownWorkflow(
  issueNumber: number, 
  commentBody: string,
  githubToken: string
) {
  // Step 1: Set up APIs
  const githubApi = createGitHubApiClient({
    token: githubToken,
    owner: 'cmbrose',
    repo: 'task-master-issues'
  });
  
  const metadataExtractor = createMetadataExtractor(githubApi);
  
  // Step 2: Parse the breakdown command from comment
  const commandResult = parseBreakdownCommand(commentBody);
  if (!commandResult.found || !commandResult.command?.isValid) {
    throw new Error(\`Invalid breakdown command: \${commandResult.command?.errors.join(', ')}\`);
  }
  
  const breakdownArgs = commandResult.validation?.normalized || {};
  console.log(\`Breakdown command parsed:, JSON.stringify(breakdownArgs)\`);
  
  // Step 3: Extract comprehensive issue metadata
  const metadata = await metadataExtractor.extractIssueMetadata(issueNumber, {
    includeComments: true,
    includeLinkedIssues: true,
    includeParsedBody: true,
    includeCommandHistory: true,
    parseCommands: true,
    analyzeLabelCategories: true
  });
  
  // Step 4: Validate issue eligibility for breakdown
  const eligibilityCheck = validateBreakdownEligibility(metadata, breakdownArgs);
  if (!eligibilityCheck.eligible) {
    throw new Error(\`Cannot breakdown issue: \${eligibilityCheck.reason}\`);
  }
  
  // Step 5: Extract task information from parsed body
  const taskInfo = extractTaskInformation(metadata);
  
  // Step 6: Check for command idempotency
  const idempotencyCheck = checkCommandIdempotency(metadata, 'breakdown');
  
  // Step 7: Execute breakdown with all context
  const result = await performBreakdown({
    metadata,
    taskInfo,
    breakdownArgs,
    idempotencyCheck
  });
  
  return result;
}

/**
 * Validate if issue can be broken down
 */
function validateBreakdownEligibility(
  metadata: IssueMetadata, 
  breakdownArgs: any
): { eligible: boolean; reason?: string } {
  // Check basic issue state
  if (metadata.state !== 'open') {
    return { eligible: false, reason: 'Issue must be open' };
  }
  
  // Check if issue has required YAML metadata
  const yamlData = metadata.parsedBody.yamlFrontMatter;
  if (!yamlData.id) {
    return { eligible: false, reason: 'Issue must have a task ID in YAML front-matter' };
  }
  
  // Check if already broken down
  const hasSubtasks = metadata.linkedIssues.some(i => i.relationship === 'child');
  if (hasSubtasks) {
    return { eligible: false, reason: 'Issue already has subtasks' };
  }
  
  // Check complexity threshold
  const complexityStr = metadata.parsedBody.metadata.complexity;
  if (complexityStr) {
    const complexity = parseInt(complexityStr.split('/')[0] || '0');
    const threshold = breakdownArgs.threshold || breakdownArgs.complexity || 30;
    
    if (complexity < threshold) {
      return { 
        eligible: false, 
        reason: \`Complexity (\${complexity}) below threshold (\${threshold})\`
      };
    }
  }
  
  // Check maximum depth
  const maxDepth = breakdownArgs.maxDepth || breakdownArgs.depth || 2;
  const currentDepth = calculateTaskDepth(metadata);
  
  if (currentDepth >= maxDepth) {
    return { 
      eligible: false, 
      reason: \`Current depth (\${currentDepth}) exceeds max depth (\${maxDepth})\`
    };
  }
  
  // Check for blocking labels
  const isBlocked = metadata.labels.some(label => 
    label.name.toLowerCase().includes('blocked') || 
    label.name.toLowerCase().includes('on-hold')
  );
  
  if (isBlocked) {
    return { eligible: false, reason: 'Issue is blocked or on hold' };
  }
  
  return { eligible: true };
}

/**
 * Extract comprehensive task information
 */
function extractTaskInformation(metadata: IssueMetadata) {
  const yamlData = metadata.parsedBody.yamlFrontMatter;
  const issueMetadata = metadata.parsedBody.metadata;
  const dependencies = metadata.parsedBody.dependencies;
  
  return {
    // Task identification
    taskId: yamlData.id,
    parentTaskId: yamlData.parent,
    title: metadata.title,
    
    // Task metadata
    status: issueMetadata.status,
    priority: issueMetadata.priority,
    complexity: issueMetadata.complexity,
    
    // Dependencies and relationships
    dependencies: dependencies.map(dep => ({
      issueNumber: dep.issueNumber,
      completed: dep.completed,
      title: dep.title
    })),
    
    linkedIssues: metadata.linkedIssues,
    
    // Repository context
    repository: metadata.repository,
    
    // Assignee and author information
    author: metadata.author,
    assignees: metadata.assignees,
    
    // Labels and categorization
    labels: metadata.labels,
    taskmasterLabels: metadata.labels.filter(l => l.isTaskmasterLabel),
    statusLabels: metadata.labels.filter(l => l.category === 'STATUS'),
    priorityLabels: metadata.labels.filter(l => l.category === 'PRIORITY'),
    
    // Content
    body: metadata.body,
    parsedContent: {
      description: metadata.parsedBody.description,
      details: metadata.parsedBody.details,
      testStrategy: metadata.parsedBody.testStrategy
    }
  };
}

/**
 * Check command idempotency to avoid duplicate execution
 */
function checkCommandIdempotency(
  metadata: IssueMetadata, 
  commandName: string
): { 
  hasRecent: boolean; 
  lastExecution?: Date; 
  executionCount: number;
  shouldSkip: boolean;
} {
  const commentContext = metadata.commentContext;
  if (!commentContext) {
    return { hasRecent: false, executionCount: 0, shouldSkip: false };
  }
  
  // Find all executions of this command
  const commandExecutions = commentContext.commandHistory.filter(cmd => 
    cmd.command === commandName && cmd.isValid
  );
  
  // Check for recent execution (within last hour)
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentExecutions = commandExecutions.filter(cmd => 
    cmd.timestamp > oneHourAgo
  );
  
  const lastExecution = commandExecutions.length > 0 
    ? commandExecutions[commandExecutions.length - 1].timestamp 
    : undefined;
  
  // Should skip if there was a recent successful execution
  const shouldSkip = recentExecutions.length > 0;
  
  return {
    hasRecent: recentExecutions.length > 0,
    lastExecution,
    executionCount: commandExecutions.length,
    shouldSkip
  };
}

/**
 * Calculate task depth in hierarchy
 */
function calculateTaskDepth(metadata: IssueMetadata): number {
  const yamlData = metadata.parsedBody.yamlFrontMatter;
  
  // If no parent, depth is 0
  if (!yamlData.parent) {
    return 0;
  }
  
  // For now, return 1 if has parent (would need recursive lookup for full depth)
  return 1;
}

/**
 * Perform the actual breakdown
 */
async function performBreakdown(context: {
  metadata: IssueMetadata;
  taskInfo: any;
  breakdownArgs: any;
  idempotencyCheck: any;
}) {
  const { metadata, taskInfo, breakdownArgs, idempotencyCheck } = context;
  
  // Skip if recent execution found
  if (idempotencyCheck.shouldSkip) {
    console.log(\`Skipping breakdown - recent execution found at \${idempotencyCheck.lastExecution}\`);
    return { skipped: true, reason: 'Recent execution found' };
  }
  
  console.log(\`Executing breakdown for task \${taskInfo.taskId}:\`);
  console.log(\`  Title: \${taskInfo.title}\`);
  console.log(\`  Complexity: \${taskInfo.complexity}\`);
  console.log(\`  Max Depth: \${breakdownArgs.maxDepth || 2}\`);
  console.log(\`  Repository: \${metadata.repository.fullName}\`);
  
  // Here you would integrate with the actual Taskmaster CLI
  // and issue creation logic
  
  return {
    success: true,
    taskId: taskInfo.taskId,
    repository: metadata.repository,
    breakdown: {
      depth: breakdownArgs.maxDepth || 2,
      threshold: breakdownArgs.threshold || 30
    },
    subtasksCreated: [] // Would be populated by actual breakdown logic
  };
}`);
  console.log('```\n');

  // Example: Label-based workflow routing
  console.log('🏷️ Label-based Workflow Routing');
  console.log('```typescript');
  console.log(`/**
 * Route workflow based on issue labels and metadata
 */
async function routeWorkflowByLabels(issueNumber: number) {
  const metadata = await metadataExtractor.extractIssueMetadata(issueNumber, {
    analyzeLabelCategories: true,
    includeParsedBody: true
  });
  
  // Group labels by category
  const labelGroups = metadata.labels.reduce((acc, label) => {
    const category = label.category || 'unknown';
    if (!acc[category]) acc[category] = [];
    acc[category].push(label);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Route based on status labels
  const statusLabels = labelGroups['STATUS'] || [];
  if (statusLabels.some(l => l.name === 'blocked')) {
    return routeToBlockedWorkflow(metadata);
  }
  
  // Route based on priority labels
  const priorityLabels = labelGroups['PRIORITY'] || [];
  const highPriorityLabel = priorityLabels.find(l => l.priority >= 4);
  if (highPriorityLabel) {
    return routeToHighPriorityWorkflow(metadata);
  }
  
  // Route based on Taskmaster labels
  const taskmasterLabels = metadata.labels.filter(l => l.isTaskmasterLabel);
  if (taskmasterLabels.length > 0) {
    return routeToTaskmasterWorkflow(metadata);
  }
  
  return routeToDefaultWorkflow(metadata);
}`);
  console.log('```\n');

  // Example: Command execution context
  console.log('💬 Command Execution Context');
  console.log('```typescript');
  console.log(`/**
 * Build comprehensive context for command execution
 */
async function buildCommandExecutionContext(
  issueNumber: number, 
  commentId: number
) {
  // Extract full metadata
  const metadata = await metadataExtractor.extractIssueMetadata(issueNumber);
  
  // Find the specific comment
  const comment = metadata.commentContext?.comments.find(c => c.id === commentId);
  if (!comment) {
    throw new Error(\`Comment \${commentId} not found\`);
  }
  
  // Extract command from comment
  const commands = comment.commands;
  if (commands.length === 0) {
    throw new Error('No valid commands found in comment');
  }
  
  const command = commands[0]; // Use first command
  
  // Build execution context
  return {
    // Command information
    command: {
      name: command.command,
      arguments: command.arguments,
      author: command.author,
      timestamp: command.timestamp,
      isValid: command.isValid,
      errors: command.errors
    },
    
    // Issue context
    issue: {
      number: metadata.number,
      title: metadata.title,
      state: metadata.state,
      author: metadata.author,
      assignees: metadata.assignees,
      labels: metadata.labels
    },
    
    // Task context (from parsed body)
    task: {
      id: metadata.parsedBody.yamlFrontMatter.id,
      parent: metadata.parsedBody.yamlFrontMatter.parent,
      dependencies: metadata.parsedBody.dependencies,
      metadata: metadata.parsedBody.metadata
    },
    
    // Repository context
    repository: metadata.repository,
    
    // Historical context
    history: {
      commandHistory: metadata.commentContext?.commandHistory || [],
      recentActivity: metadata.commentContext?.recentActivity,
      participants: metadata.commentContext?.participants || []
    },
    
    // Permissions context
    permissions: {
      canExecuteCommand: checkCommandPermissions(command.author, metadata),
      isAuthorized: checkAuthorization(command.author, metadata.repository)
    }
  };
}

function checkCommandPermissions(author: any, metadata: IssueMetadata): boolean {
  // Check if author is issue author, assignee, or repo collaborator
  return (
    author.login === metadata.author.login ||
    metadata.assignees.some(assignee => assignee.login === author.login) ||
    author.siteAdmin
  );
}

function checkAuthorization(author: any, repository: any): boolean {
  // Basic authorization check (would need more sophisticated logic)
  return !author.type || author.type === 'User';
}`);
  console.log('```\n');

  console.log('✨ Integration Benefits:');
  console.log('   - Comprehensive issue context for command execution');
  console.log('   - Seamless integration with existing parsers');
  console.log('   - Rich metadata for workflow automation');
  console.log('   - Idempotency and permission checking');
  console.log('   - Performance optimization with caching');
  console.log('   - Error handling and fallback mechanisms');
}

// Run the demonstration
if (require.main === module) {
  demonstrateIntegration();
}

export { demonstrateIntegration };