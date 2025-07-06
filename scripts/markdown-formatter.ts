/**
 * Markdown Formatter for Task Graph Preview
 * 
 * Converts task graph JSON into human-readable markdown format with:
 * - Task hierarchy
 * - Dependencies
 * - Complexity scores
 * - Blocked/unblocked status
 * - Collapsible sections for better readability
 */

import { components } from "@octokit/openapi-types";

// GitHub API types
type ApiIssue = components["schemas"]["issue"];

/**
 * Task interface with all relevant metadata
 */
export interface Task {
  id: number;
  title: string;
  description?: string;
  details?: string;
  testStrategy?: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Task[];
  requiredBy?: Task[];
  complexityScore?: number;
  isBlocked?: boolean;
  blockedBy?: string[];
}

/**
 * Task graph structure
 */
export interface TaskGraph {
  tasks: Task[];
  metadata?: {
    totalTasks?: number;
    leafTasks?: number;
    hierarchyDepth?: number;
    generationTimestamp?: string;
    complexityThreshold?: number;
    maxDepth?: number;
  };
}

/**
 * Options for markdown formatting
 */
export interface MarkdownFormatterOptions {
  /** Include task details in collapsible sections */
  includeDetails?: boolean;
  /** Include test strategy information */
  includeTestStrategy?: boolean;
  /** Maximum depth for task hierarchy display */
  maxDisplayDepth?: number;
  /** Show complexity scores */
  showComplexity?: boolean;
  /** Show blocked/unblocked status */
  showBlockedStatus?: boolean;
  /** Use collapsible sections for subtasks */
  useCollapsibleSections?: boolean;
  /** Include summary statistics */
  includeSummary?: boolean;
}

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: MarkdownFormatterOptions = {
  includeDetails: true,
  includeTestStrategy: true,
  maxDisplayDepth: 3,
  showComplexity: true,
  showBlockedStatus: true,
  useCollapsibleSections: true,
  includeSummary: true
};

/**
 * Calculate task statistics for summary
 */
function calculateTaskStats(tasks: Task[]): {
  total: number;
  completed: number;
  blocked: number;
  ready: number;
  leaf: number;
  maxDepth: number;
} {
  let total = 0;
  let completed = 0;
  let blocked = 0;
  let ready = 0;
  let leaf = 0;
  let maxDepth = 0;

  function processTask(task: Task, depth: number = 1): void {
    total++;
    maxDepth = Math.max(maxDepth, depth);

    if (task.status === 'completed' || task.status === 'done') {
      completed++;
    } else if (task.isBlocked) {
      blocked++;
    } else {
      ready++;
    }

    if (!task.subtasks || task.subtasks.length === 0) {
      leaf++;
    } else {
      task.subtasks.forEach(subtask => processTask(subtask, depth + 1));
    }
  }

  tasks.forEach(task => processTask(task));
  
  return { total, completed, blocked, ready, leaf, maxDepth };
}

/**
 * Format complexity score with visual indicator
 */
function formatComplexityScore(score?: number): string {
  if (score === undefined) return 'N/A';
  
  let indicator = '';
  if (score >= 8) indicator = '🔴'; // High complexity
  else if (score >= 5) indicator = '🟡'; // Medium complexity
  else indicator = '🟢'; // Low complexity
  
  return `${indicator} ${score}/10`;
}

/**
 * Format blocked status with visual indicator
 */
function formatBlockedStatus(task: Task): string {
  if (task.status === 'completed' || task.status === 'done') {
    return '✅ Completed';
  } else if (task.isBlocked) {
    const blockedBy = task.blockedBy?.length ? ` (blocked by: ${task.blockedBy.join(', ')})` : '';
    return `🚫 Blocked${blockedBy}`;
  } else {
    return '🟢 Ready';
  }
}

/**
 * Format task priority with visual indicator
 */
function formatPriority(priority?: string): string {
  if (!priority) return '';
  
  const priorityMap: Record<string, string> = {
    'critical': '🔥 Critical',
    'high': '⚠️ High',
    'medium': '📝 Medium',
    'low': '📋 Low'
  };
  
  return priorityMap[priority.toLowerCase()] || `📌 ${priority}`;
}

/**
 * Format dependencies list
 */
function formatDependencies(dependencies?: number[]): string {
  if (!dependencies || dependencies.length === 0) return 'None';
  return dependencies.map(dep => `#${dep}`).join(', ');
}

/**
 * Format a single task with all metadata
 */
function formatTask(task: Task, options: MarkdownFormatterOptions, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const taskId = `**Task ${task.id}**`;
  const title = task.title;
  
  let result = `${indent}- ${taskId}: ${title}\n`;
  
  // Add task metadata
  const metadata: string[] = [];
  
  if (options.showComplexity && task.complexityScore !== undefined) {
    metadata.push(`Complexity: ${formatComplexityScore(task.complexityScore)}`);
  }
  
  if (options.showBlockedStatus) {
    metadata.push(`Status: ${formatBlockedStatus(task)}`);
  }
  
  if (task.priority) {
    metadata.push(`Priority: ${formatPriority(task.priority)}`);
  }
  
  if (task.dependencies && task.dependencies.length > 0) {
    metadata.push(`Dependencies: ${formatDependencies(task.dependencies)}`);
  }
  
  if (metadata.length > 0) {
    result += `${indent}  ${metadata.join(' | ')}\n`;
  }
  
  // Add description if available
  if (task.description) {
    const shortDesc = task.description.length > 100 
      ? `${task.description.substring(0, 100)}...`
      : task.description;
    result += `${indent}  *${shortDesc}*\n`;
  }
  
  // Add collapsible details section
  if (options.includeDetails && (task.details || task.testStrategy)) {
    result += `${indent}  <details>\n`;
    result += `${indent}  <summary>📋 Details</summary>\n\n`;
    
    if (task.details) {
      result += `${indent}  **Details:**\n${indent}  ${task.details}\n\n`;
    }
    
    if (options.includeTestStrategy && task.testStrategy) {
      result += `${indent}  **Test Strategy:**\n${indent}  ${task.testStrategy}\n\n`;
    }
    
    result += `${indent}  </details>\n`;
  }
  
  return result;
}

/**
 * Format subtasks with proper hierarchy
 */
function formatSubtasks(subtasks: Task[], options: MarkdownFormatterOptions, depth: number = 0): string {
  if (!subtasks || subtasks.length === 0) return '';
  
  let result = '';
  
  for (const subtask of subtasks) {
    result += formatTask(subtask, options, depth + 1);
    
    // Recursively format nested subtasks if within depth limit
    if (subtask.subtasks && depth < (options.maxDisplayDepth || 3) - 1) {
      result += formatSubtasks(subtask.subtasks, options, depth + 1);
    }
  }
  
  return result;
}

/**
 * Generate task graph summary statistics
 */
function formatSummary(taskGraph: TaskGraph): string {
  const stats = calculateTaskStats(taskGraph.tasks);
  const metadata = taskGraph.metadata;
  
  let summary = '## 📊 Task Graph Summary\n\n';
  
  // Progress overview
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  summary += `**Progress:** ${stats.completed}/${stats.total} tasks completed (${completionRate}%)\n\n`;
  
  // Status breakdown
  summary += '**Task Status:**\n';
  summary += `- ✅ Completed: ${stats.completed}\n`;
  summary += `- 🟢 Ready: ${stats.ready}\n`;
  summary += `- 🚫 Blocked: ${stats.blocked}\n`;
  summary += `- 📄 Total: ${stats.total}\n\n`;
  
  // Structure information
  summary += '**Structure:**\n';
  summary += `- 🌳 Hierarchy Depth: ${stats.maxDepth}\n`;
  summary += `- 🍃 Leaf Tasks: ${stats.leaf}\n`;
  
  // Generation metadata
  if (metadata) {
    summary += '\n**Configuration:**\n';
    if (metadata.complexityThreshold) {
      summary += `- 🎯 Complexity Threshold: ${metadata.complexityThreshold}/10\n`;
    }
    if (metadata.maxDepth) {
      summary += `- 📏 Max Depth: ${metadata.maxDepth}\n`;
    }
    if (metadata.generationTimestamp) {
      const date = new Date(metadata.generationTimestamp);
      summary += `- 🕒 Generated: ${date.toLocaleString()}\n`;
    }
  }
  
  return summary + '\n';
}

/**
 * Format full task graph into markdown with collapsible sections
 */
export function formatTaskGraphMarkdown(taskGraph: TaskGraph, options: Partial<MarkdownFormatterOptions> = {}): string {
  const opts: MarkdownFormatterOptions = { ...DEFAULT_OPTIONS, ...options };
  
  let markdown = '# 🚀 Task Graph Preview\n\n';
  
  // Add summary if requested
  if (opts.includeSummary) {
    markdown += formatSummary(taskGraph);
  }
  
  // Add main task hierarchy
  markdown += '## 📋 Task Hierarchy\n\n';
  
  if (!taskGraph.tasks || taskGraph.tasks.length === 0) {
    markdown += '*No tasks found in task graph.*\n\n';
    return markdown;
  }
  
  for (const task of taskGraph.tasks) {
    markdown += formatTask(task, opts);
    
    // Add subtasks in collapsible section if they exist
    if (task.subtasks && task.subtasks.length > 0 && opts.useCollapsibleSections) {
      markdown += '  <details>\n';
      markdown += `  <summary>📂 Subtasks (${task.subtasks.length})</summary>\n\n`;
      markdown += formatSubtasks(task.subtasks, opts, 1);
      markdown += '  </details>\n';
    } else if (task.subtasks && task.subtasks.length > 0) {
      markdown += formatSubtasks(task.subtasks, opts, 0);
    }
    
    markdown += '\n';
  }
  
  // Add legend
  markdown += '---\n\n';
  markdown += '### 🔍 Legend\n\n';
  markdown += '**Complexity:** 🟢 Low (1-4) | 🟡 Medium (5-7) | 🔴 High (8-10)\n\n';
  markdown += '**Status:** ✅ Completed | 🟢 Ready | 🚫 Blocked\n\n';
  markdown += '**Priority:** 🔥 Critical | ⚠️ High | 📝 Medium | 📋 Low\n\n';
  
  return markdown;
}

/**
 * Generate a compact task graph summary for PR comments
 */
export function formatCompactTaskGraphSummary(taskGraph: TaskGraph): string {
  const stats = calculateTaskStats(taskGraph.tasks);
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  
  return `**Task Graph:** ${stats.total} tasks (${completionRate}% complete) | ` +
         `${stats.ready} ready, ${stats.blocked} blocked | ` +
         `Depth: ${stats.maxDepth} levels`;
}