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

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as yaml from 'js-yaml';

import { components } from "@octokit/openapi-types";

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

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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

// Helper to parse YAML front-matter from issue body
function parseYamlFrontMatter(body: string): { frontMatter: any; content: string } {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = body.match(frontMatterRegex);
  
  if (match) {
    try {
      const frontMatter = yaml.load(match[1]) as any;
      return { frontMatter, content: match[2] };
    } catch (e) {
      console.warn('Failed to parse YAML front-matter:', e);
      return { frontMatter: {}, content: body };
    }
  }
  
  return { frontMatter: {}, content: body };
}

// Helper to create YAML front-matter for issue body
function createYamlFrontMatter(task: Task, parentTask?: Task): any {
  const frontMatter: any = {};
  
  // Add task ID
  if (parentTask) {
    frontMatter.id = `${parentTask.id}.${task.id}`;
    frontMatter.parent = parentTask.id;
  } else {
    frontMatter.id = task.id;
  }
  
  // Add dependencies
  if (task.dependencies?.length) {
    frontMatter.dependencies = task.dependencies;
  }
  
  // Add required by relationships
  if (task.requiredBy?.length) {
    frontMatter.dependents = task.requiredBy.map(t => t.id);
  }
  
  // Add status and priority
  if (task.status) {
    frontMatter.status = task.status;
  }
  if (task.priority) {
    frontMatter.priority = task.priority;
  }
  
  return frontMatter;
}

// Helper to determine if an issue should be blocked
function isIssueBlocked(task: Task, idToIssue: Record<string, Issue>, parentTask?: Task): boolean {
  if (!task.dependencies?.length) return false;
  
  return task.dependencies.some(depId => {
    const depKey = parentTask ? `${parentTask.id}.${depId}` : `${depId}`;
    const depIssue = idToIssue[depKey];
    return depIssue && depIssue.state !== 'closed';
  });
}

// Helper to create issue body with YAML front-matter
function buildIssueBody(task: Task, parentIssue?: Issue, parentTask?: Task): string {
  const frontMatter = createYamlFrontMatter(task, parentTask);
  let yamlString = '';
  
  if (Object.keys(frontMatter).length > 0) {
    yamlString = '---\n' + yaml.dump(frontMatter) + '---\n\n';
  }
  
  let body = yamlString;
  
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
  if (!allIssuesCache.length) {
    const issues = await octokit.issues.listForRepo({
      owner: GITHUB_OWNER!,
      repo: GITHUB_REPO!,
      state: 'all',
      per_page: 100,
    });
    allIssuesCache = issues.data;
  }

  for (const issue of allIssuesCache) {
    if (issue.title === title && issue.body && issue.body.includes(UNIQUE_MARKER)) {
      return issue;
    }
  }
  return null;
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

  const body = buildIssueBody(task, parentIssue, parentTask);

  let existingIssue = await findExistingIssue(title);
  if (existingIssue) {
    console.log(`Issue already exists for: ${title} (#${existingIssue.number})`);
    return {
      ...existingIssue,
      expectedBody: body,
    };
  }

  // Determine initial labels
  const labels = ['taskmaster'];
  
  // Add blocked label if task has unresolved dependencies
  // Note: We'll determine this after all issues are created, for now just add taskmaster label

  const res = await octokit.issues.create({
    owner: GITHUB_OWNER!,
    repo: GITHUB_REPO!,
    title,
    body,
    labels,
  });

  allIssuesCache.push(res.data);
  console.log(`Created issue: ${title} (#${res.data.number})`);

  return {
    ...res.data,
    expectedBody: body,
  };
}

// Helper to add sub-issue (GitHub Projects/Tasks API) with error handling
async function addSubIssue(parentIssue: ParentIssue, subIssue: Issue) {
  if (parentIssue.subIssues.some(s => s.id === subIssue.id)) {
    console.log(`Sub-issue #${subIssue.number} is already a sub-issue of parent #${parentIssue.number}.`);
    return;
  }

  try {
    await octokit.issues.addSubIssue({
      owner: GITHUB_OWNER!,
      repo: GITHUB_REPO!,
      issue_number: parentIssue.number,
      sub_issue_id: subIssue.id,
    });
    parentIssue.subIssues.push(subIssue);
    console.log(`Added sub-issue #${subIssue.number} to parent #${parentIssue.number}.`);
  } catch (error) {
    console.warn(`Failed to add sub-issue #${subIssue.number} to parent #${parentIssue.number}:`, error);
    // Continue execution even if Sub-issues API fails
    // We'll track the relationship through YAML front-matter instead
  }
}

// Helper to manage blocked label on an issue
async function updateBlockedLabel(issue: Issue, shouldBeBlocked: boolean) {
  const currentLabels = issue.labels?.map(l => typeof l === 'string' ? l : l.name) || [];
  const hasBlockedLabel = currentLabels.includes('blocked');
  
  if (shouldBeBlocked && !hasBlockedLabel) {
    try {
      await octokit.issues.addLabels({
        owner: GITHUB_OWNER!,
        repo: GITHUB_REPO!,
        issue_number: issue.number,
        labels: ['blocked'],
      });
      console.log(`Added 'blocked' label to issue #${issue.number}`);
    } catch (error) {
      console.warn(`Failed to add 'blocked' label to issue #${issue.number}:`, error);
    }
  } else if (!shouldBeBlocked && hasBlockedLabel) {
    try {
      await octokit.issues.removeLabel({
        owner: GITHUB_OWNER!,
        repo: GITHUB_REPO!,
        issue_number: issue.number,
        name: 'blocked',
      });
      console.log(`Removed 'blocked' label from issue #${issue.number}`);
    } catch (error) {
      console.warn(`Failed to remove 'blocked' label from issue #${issue.number}:`, error);
    }
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
  try {
    const subIssues = await octokit.issues.listSubIssues({
      owner: GITHUB_OWNER!,
      repo: GITHUB_REPO!,
      issue_number: issue.number,
    });
    return subIssues.data;
  } catch (error) {
    console.warn(`Failed to get sub-issues for issue #${issue.number}:`, error);
    // Return empty array if Sub-issues API is unavailable
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

  // Update issues with dependency links and blocked status
  // For parent tasks
  for (const task of tasks) {
    const issue = idToIssue[`${task.id}`];

    const depIssues = task.dependencies?.map(depId => idToIssue[`${depId}`]).filter(Boolean);
    issue.expectedBody = updateIssueWithDependencies(issue.expectedBody, depIssues);

    const reqByIssues = task.requiredBy?.map(reqBy => idToIssue[`${reqBy.id}`]).filter(Boolean);
    issue.expectedBody = updateBodyWithRequiredBy(issue.expectedBody, reqByIssues);

    // Check if issue should be blocked
    const shouldBeBlocked = isIssueBlocked(task, idToIssue);
    await updateBlockedLabel(issue, shouldBeBlocked);

    if (issue.expectedBody !== issue.body) {
      await octokit.issues.update({
        owner: GITHUB_OWNER!,
        repo: GITHUB_REPO!,
        issue_number: issue.number,
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

        // Check if subtask should be blocked
        const shouldBeBlocked = isIssueBlocked(sub, idToIssue, task);
        await updateBlockedLabel(issue, shouldBeBlocked);

        if (issue.expectedBody !== issue.body) {
          await octokit.issues.update({
            owner: GITHUB_OWNER!,
            repo: GITHUB_REPO!,
            issue_number: issue.number,
            body: issue.expectedBody,
          });
          console.log(`Updated issue #${issue.number} with dependencies/required-bys.`);
        }
      }
    }
  }

  console.log('All issues created and linked.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 