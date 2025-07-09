/**
 * Sub-Issue Creation Utilities
 * 
 * Shared utilities for creating sub-issues from task breakdown results.
 * Used by both taskmaster-generate and taskmaster-breakdown actions.
 */

import { EnhancedGitHubApi, ApiIssue } from './github-api';
import { formatError } from './platform-utils';

// Task interfaces (shared types)
export interface Task {
  id: number;
  title: string;
  description: string;
  details?: string;
  testStrategy?: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Task[];
  // Added by app logic
  requiredBy?: Task[];
}

export interface Issue extends ApiIssue {
  expectedBody: string;
  number: number;
  state: string;
  id: number;
  title: string;
  labels: any[];
}

export interface ParentIssue extends Issue {
  subIssues: ApiIssue[];
  number: number;
}

const UNIQUE_MARKER = '<!-- created-by-taskmaster-script -->';

/**
 * Generate comprehensive labels for sub-issues created from breakdown
 */
export function generateSubIssueLabels(
  task: Task, 
  parentTask?: Task, 
  complexityScore?: number,
  isBreakdownSubIssue: boolean = false
): string[] {
  const labels = ['taskmaster'];
  
  // Priority labels
  if (task.priority) {
    labels.push(`priority:${task.priority.toLowerCase()}`);
  }
  
  // Status labels
  if (task.status) {
    labels.push(`status:${task.status.toLowerCase()}`);
  }
  
  // Task type labels
  if (parentTask) {
    labels.push('subtask');
    labels.push(`parent:${parentTask.id}`);
  } else {
    labels.push('main-task');
  }

  // Mark breakdown-generated sub-issues
  if (isBreakdownSubIssue) {
    labels.push('breakdown-generated');
  }
  
  // Complexity labels
  if (complexityScore !== undefined) {
    if (complexityScore >= 8) {
      labels.push('complexity:high');
    } else if (complexityScore >= 5) {
      labels.push('complexity:medium');
    } else {
      labels.push('complexity:low');
    }
  }
  
  // Dependency status labels
  if (task.dependencies && task.dependencies.length > 0) {
    labels.push('has-dependencies');
  }
  
  // Hierarchy labels
  if (task.subtasks && task.subtasks.length > 0) {
    labels.push('has-subtasks');
  }
  
  return labels;
}

/**
 * Create enhanced issue title with priority ordering for breakdown sub-issues
 */
export function buildSubIssueTitle(task: Task, parentTask?: Task, parentIssueNumber?: number): string {
  // Priority prefixes for ordering (high priority tasks appear first)
  const priorityPrefix = task.priority ? 
    (task.priority.toLowerCase() === 'high' ? '[🔴 HIGH] ' : 
     task.priority.toLowerCase() === 'medium' ? '[🟡 MED] ' : 
     task.priority.toLowerCase() === 'low' ? '[🟢 LOW] ' : '') : '';
  
  let title: string;
  
  if (parentIssueNumber) {
    // For breakdown sub-issues, reference the parent issue number
    title = `${priorityPrefix}[#${parentIssueNumber}.${task.id}] ${task.title}`;
  } else if (parentTask && 'id' in task) {
    title = `${priorityPrefix}[${parentTask.id}.${task.id}] ${task.title}`;
  } else {
    title = `${priorityPrefix}[${task.id}] ${task.title}`;
  }
  
  return title;
}

/**
 * Build issue body for breakdown sub-issues
 */
export function buildSubIssueBody(
  task: Task, 
  parentIssue?: Issue,
  parentTask?: Task,
  complexityScore?: number
): string {
  let body = '';
  
  // Add description
  if (task.description) {
    body += `## Details\n${task.description}\n\n`;
  }
  
  // Add details section if available
  if (task.details) {
    body += `${task.details}\n\n`;
  }
  
  // Add test strategy if available
  if (task.testStrategy) {
    body += `## Test Strategy\n${task.testStrategy}\n\n`;
  }
  
  // Dependencies section (will be filled in later)
  if (task.dependencies && task.dependencies.length > 0) {
    body += `## Dependencies\n\n\n`;
  }
  
  // Meta section
  let meta = '';
  if (task.status) {
    meta += `- **Status:** \`${task.status}\`\n`;
  }
  if (task.priority) {
    meta += `- **Priority:** \`${task.priority}\`\n`;
  }
  if (complexityScore !== undefined) {
    meta += `- **Complexity:** \`${complexityScore} / 10\`\n`;
  }
  if (parentIssue) {
    meta += `- **Parent Task:** #${parentIssue.number}\n`;
  }
  if (task.requiredBy?.length) {
    meta += `- **Required By:**\n\n`;
  }
  
  if (meta) {
    body += `## Meta\n${meta}\n\n`;
  }
  
  body += UNIQUE_MARKER;
  
  return body;
}

/**
 * Create a sub-issue from task breakdown results
 */
export async function createSubIssueFromTask(
  githubApi: EnhancedGitHubApi,
  task: Task,
  parentIssue: Issue,
  parentTask?: Task,
  complexityScore?: number
): Promise<Issue> {
  const title = buildSubIssueTitle(task, parentTask, parentIssue.number);
  const body = buildSubIssueBody(task, parentIssue, parentTask, complexityScore);
  const labels = generateSubIssueLabels(task, parentTask, complexityScore, true);

  // Check if issue already exists
  const existingIssue = await githubApi.findExistingIssue(title, UNIQUE_MARKER);
  if (existingIssue) {
    console.log(`Sub-issue already exists: ${title} (#${existingIssue.number})`);
    return {
      ...existingIssue,
      expectedBody: body,
    };
  }

  // Create new sub-issue
  const createdIssue = await githubApi.createIssue({
    title,
    body,
    labels,
  });

  console.log(`Created breakdown sub-issue: ${title} (#${createdIssue.number})`);

  return {
    ...createdIssue,
    expectedBody: body,
  };
}

/**
 * Update issue body with dependency links
 */
export function updateIssueWithDependencies(body: string, dependencyIssues: Issue[] | undefined): string {
  if (!dependencyIssues?.length) return body;

  const depSection = `## Dependencies\n${dependencyIssues.map(i => `- [${i.state === 'closed' ? 'x' : ' '}] #${i.number}`).join('\n')}\n\n`;

  return body.replace(/## Dependencies[\s\S]+?\n\n/, depSection);
}

/**
 * Update issue body with required-by links
 */
export function updateBodyWithRequiredBy(body: string, requiredByIssues: Issue[] | undefined): string {
  if (!requiredByIssues?.length) return body;
  
  const requiredBySection = `- **Required By:**\n${requiredByIssues.map(i => `   - [${i.state === 'closed' ? 'x' : ' '}] #${i.number}`).join('\n')}\n`;
  
  return body.replace(/- \*\*Required By:\*\*[\s\S]+?\n\n/, requiredBySection);
}

/**
 * Add a sub-issue relationship using GitHub's sub-issue API
 */
export async function addSubIssueRelationship(
  githubApi: EnhancedGitHubApi, 
  parentIssue: ParentIssue, 
  subIssue: Issue
): Promise<void> {
  if (parentIssue.subIssues.some(s => s.id === subIssue.id)) {
    console.log(`Sub-issue #${subIssue.number} is already a sub-issue of parent #${parentIssue.number}.`);
    return;
  }

  try {
    await githubApi.addSubIssue(parentIssue.number, subIssue.number);
    parentIssue.subIssues.push(subIssue);
    console.log(`Added sub-issue #${subIssue.number} to parent #${parentIssue.number}.`);
  } catch (error) {
    console.warn(`Failed to add sub-issue relationship: ${formatError(error)}`);
    // Continue without sub-issue relationship
  }
}

/**
 * Update dependency labels based on issue states
 */
export function updateDependencyLabels(task: Task, dependencyIssues: Issue[] | undefined): string[] {
  const additionalLabels: string[] = [];
  if (!dependencyIssues || dependencyIssues.length === 0) {
    return additionalLabels;
  }

  const openDependencies = dependencyIssues.filter(issue => issue.state === 'open');
  if (openDependencies.length > 0) {
    additionalLabels.push('blocked');
    additionalLabels.push(`blocked-by:${openDependencies.length}`);
  } else {
    // All dependencies are closed, task is ready
    additionalLabels.push('ready');
  }

  return additionalLabels;
}