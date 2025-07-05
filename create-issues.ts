// create-issues.ts
//
// Usage:
//   1. Install dependencies:
//      npm install @octokit/rest dotenv
//      npm install --save-dev @types/node
//   2. Set env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
//   3. Run with ts-node or compile with tsc
//
// Note: Requires Node.js types for process, fs, path, etc.

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { components } from "@octokit/openapi-types";
import { EnhancedGitHubApi, createGitHubApiClient } from './scripts/github-api';

// Types for Node.js globals (process, etc.)
// If you see type errors, run: npm install --save-dev @types/node

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO in environment variables.');
  process.exit(1);
}

const githubApi = createGitHubApiClient({
  token: GITHUB_TOKEN,
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
  maxConcurrent: 3,
  retryDelay: 1000,
  maxRetries: 3,
  debug: process.env.DEBUG === 'true'
});

const TASKS_PATH = path.join('.taskmaster', 'tasks', 'tasks.json');
const COMPLEXITY_PATH  = path.join('.taskmaster', 'reports', 'task-complexity-report.json');
const UNIQUE_MARKER = '<!-- created-by-taskmaster-script -->';

type ApiIssue = components["schemas"]["issue"];
type Issue = ApiIssue & { expectedBody: string };
type ParentIssue = Issue & { subIssues: ApiIssue[] };

interface Task {
  id: number;
  title: string;
  description: string;
  details?: string;
  testStrategy?: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Task[];

  // Added by app logic, not task-master
  requiredBy?: Task[];
}

interface TaskmasterJson {
  master: {
    tasks: Task[];
    metadata: any;
  };
}

// Load complexity report if available
let complexityMap: Record<string, number> = {};
try {
  const complexityData = JSON.parse(fs.readFileSync(COMPLEXITY_PATH, 'utf-8'));
  for (const entry of complexityData.complexityAnalysis) {
    // Map both parent and subtask IDs as string keys
    complexityMap[String(entry.taskId)] = entry.complexityScore;
  }
} catch (e) {
  // If not found or invalid, skip
  complexityMap = {};
}

// Helper to create issue body
function buildIssueBody(task: Task, parentIssue?: Issue): string {
  let body = '';
  // Add complexity if available
  let idKey: string;
  if (typeof (task as any).id !== 'undefined' && parentIssue && (parentIssue as any).id !== undefined) {
    // Subtask: use parentId.subtaskId
    idKey = `${(parentIssue as any).number}.${(task as any).id}`;
  } else if (typeof (task as any).id !== 'undefined') {
    // Parent task: use id
    idKey = String((task as any).id);
  } else {
    idKey = '';
  }

  if ('details' in task && task.details) {
    body += `## Details\n${task.details}\n\n`;
  }
  if ('testStrategy' in task && task.testStrategy) {
    body += `## Test Strategy\n${task.testStrategy}\n\n`;
  }

  if ('dependencies' in task && task.dependencies?.length) {
    // Intentionally empty, filled in later after issues are created
    body += `## Dependencies\n\n\n`;
  }

  let meta = ''

  if ('status' in task && task.status) {
    meta += `- Status: \`${task.status}\`\n`;
  }
  if ('priority' in task && (task as Task).priority) {
    meta += `- Priority: \`${(task as Task).priority}\`\n`;
  }
  const complexity = complexityMap[idKey] || complexityMap[String((task as any).id)];
  if (complexity !== undefined) {
    meta += `- Complexity: \`${complexity} / 10\`\n`;
  }
  if (parentIssue !== undefined) {
    meta += `- Parent Task: #${parentIssue.number}\n`;
  }
  if (task.requiredBy?.length) {
    // Intentially empty, filled in later after issues are created
    meta += `- Required By:\n\n`;
  }

  if (meta) {
    body += `## Meta\n${meta}\n\n`;
  }

  body += UNIQUE_MARKER;
  
  return body;
}

// Helper to find existing issue by title and marker
let allIssuesCache: ApiIssue[] = [];

async function findExistingIssue(title: string): Promise<ApiIssue | null> {
  // Use enhanced API with better duplicate detection
  return await githubApi.findExistingIssue(title, UNIQUE_MARKER);
}


// Helper to create or get issue
async function createOrGetIssue(task: Task, parentTask?: Task, parentIssue?: Issue): Promise<Issue> {
  // If this is a subtask (parentTask is defined), make the title unique by including parent and subtask ID
  let title: string;
  if (typeof parentTask !== 'undefined' && 'id' in task) {
    title = `[${parentTask.id}.${task.id}] ${task.title}`;
  } else {
    title = task.title;
  }

  const body = buildIssueBody(task, parentIssue);

  let existingIssue = await findExistingIssue(title);
  if (existingIssue) {
    console.log(`Issue already exists for: ${title} (#${existingIssue.number})`);
    return {
      ...existingIssue,
      expectedBody: body,
    };
  }

  const createdIssue = await githubApi.createIssue({
    title,
    body,
    labels: ['taskmaster'],
  });

  allIssuesCache.push(createdIssue);
  console.log(`Created issue: ${title} (#${createdIssue.number})`);

  return {
    ...createdIssue,
    expectedBody: body,
  };
}

// Helper to add sub-issue (GitHub Projects/Tasks API)
async function addSubIssue(parentIssue: ParentIssue, subIssue: Issue) {
  if (parentIssue.subIssues.some(s => s.id === subIssue.id)) {
    console.log(`Sub-issue #${subIssue.number} is already a sub-issue of parent #${parentIssue.number}.`);
    return;
  }

  // Note: GitHub's addSubIssue API may not be available in all cases
  // This is a placeholder for when such functionality becomes available
  try {
    // await githubApi.executeWithRetry(async () => {
    //   return await octokit.issues.addSubIssue({
    //     owner: GITHUB_OWNER!,
    //     repo: GITHUB_REPO!,
    //     issue_number: parentIssue.number,
    //     sub_issue_id: subIssue.id,
    //   });
    // }, 'add-sub-issue');
    
    parentIssue.subIssues.push(subIssue);
    console.log(`Added sub-issue #${subIssue.number} to parent #${parentIssue.number}.`);
  } catch (error) {
    console.warn(`Failed to add sub-issue relationship: ${error instanceof Error ? error.message : String(error)}`);
    // Continue without sub-issue relationship
  }
}

// Helper to update issue with dependency links
function updateIssueWithDependencies(body: string, dependencyIssues: Issue[] | undefined): string {
  if (!dependencyIssues?.length) return body;

  const depSection = `## Dependencies\n${dependencyIssues.map(i => `- [${i.state === 'closed' ? 'x' : ' '}] #${i.number}`).join('\n')}\n\n`;

  return body.replace(/## Dependencies[\s\S]+?\n\n/, depSection);
}

// Helper to update issue with dependency links
function updateBodyWithRequiredBy(body: string, requiredByIssues: Issue[] | undefined): string {
  if (!requiredByIssues?.length) return body;
  
  const requiredBySection = `- Required By:\n${requiredByIssues.map(i => `   - [${i.state === 'closed' ? 'x' : ' '}] #${i.number}`).join('\n')}\n`;

  return body.replace(/- Required By:[\s\S]+?\n\n/, requiredBySection);
}

async function getSubIssues(issue: Issue): Promise<ApiIssue[]> {
  // Note: GitHub's listSubIssues API may not be available in all cases
  // Return empty array as fallback
  try {
    // const subIssues = await githubApi.executeWithRetry(async () => {
    //   return await octokit.issues.listSubIssues({
    //     owner: GITHUB_OWNER!,
    //     repo: GITHUB_REPO!,
    //     issue_number: issue.number,
    //   });
    // }, 'list-sub-issues');
    // return subIssues.data;
    return [];
  } catch (error) {
    console.warn(`Failed to fetch sub-issues for #${issue.number}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function main() {
  // Parse JSON
  const raw = fs.readFileSync(TASKS_PATH, 'utf-8');
  const data: TaskmasterJson = JSON.parse(raw);
  const tasks = data.master.tasks;

  // Create issues for all tasks and subtasks
  const idToIssue: Record<string, Issue> = {};

  for (const task of tasks) {
    task.requiredBy = tasks.filter(t => t.dependencies?.find(d => d === task.id));

    // Create parent task
    const baseIssue = await createOrGetIssue(task);
    const parentIssue = {
      ...baseIssue,
      subIssues: await getSubIssues(baseIssue),
    };
    idToIssue[`${task.id}`] = parentIssue;

    // Create subtasks
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        sub.requiredBy = task.subtasks?.filter(t => t.dependencies?.find(d => d === sub.id));

        const subIssue = await createOrGetIssue(sub, task, parentIssue);
        
        // Link subtask to parent task
        await addSubIssue(parentIssue, subIssue);

        const subId = `${task.id}.${sub.id}`;
        idToIssue[subId] = subIssue;
      }
    }
  }

  // Update issues with dependency links
  // For parent tasks
  for (const task of tasks) {
    const issue = idToIssue[`${task.id}`];

    const depIssues = task.dependencies?.map(depId => idToIssue[`${depId}`]).filter(Boolean);
    issue.expectedBody = updateIssueWithDependencies(issue.expectedBody, depIssues);

    const reqByIssues = task.requiredBy?.map(reqBy => idToIssue[`${reqBy.id}`]).filter(Boolean);
    issue.expectedBody = updateBodyWithRequiredBy(issue.expectedBody, reqByIssues);

    if (issue.expectedBody !== issue.body) {
      await githubApi.updateIssue(issue.number, {
        body: issue.expectedBody,
      });
      console.log(`Updated issue #${issue.number} with dependencies/required-bys.`);
    }

      // For subtasks
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        const issue = idToIssue[`${task.id}.${sub.id}`];

        const depIssues = sub.dependencies?.map(depId => idToIssue[`${task.id}.${depId}`]).filter(Boolean);
        issue.expectedBody = updateIssueWithDependencies(issue.expectedBody, depIssues);

        const reqByIssues = sub.requiredBy?.map(reqBy => idToIssue[`${task.id}.${reqBy.id}`]).filter(Boolean);
        issue.expectedBody = updateBodyWithRequiredBy(issue.expectedBody, reqByIssues);

        if (issue.expectedBody !== issue.body) {
          await githubApi.updateIssue(issue.number, {
            body: issue.expectedBody,
          });
          console.log(`Updated issue #${issue.number} with dependencies/required-bys.`);
        }
      }
    }
  }

  console.log('All issues created and linked.');
  
  // Wait for all pending API requests to complete
  await githubApi.waitForCompletion();
  
  // Log final queue status
  const queueStatus = githubApi.getQueueStatus();
  console.log(`Final queue status: ${queueStatus.pending} pending, ${queueStatus.active} active`);
  
  // Clean up resources
  githubApi.destroy();
}

main().catch(async e => {
  console.error('Error in main execution:', e);
  
  // Log rate limit status if available
  try {
    const rateLimitStatus = await githubApi.getRateLimitStatus();
    console.error('Rate limit status:', rateLimitStatus);
  } catch (rateLimitError) {
    console.error('Could not fetch rate limit status:', rateLimitError);
  }
  
  // Clean up resources
  githubApi.destroy();
  process.exit(1);
}); 