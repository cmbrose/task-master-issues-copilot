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
const UNIQUE_MARKER = '<!-- created-by-taskmaster-script -->';

interface Subtask {
  id: number;
  title: string;
  description: string;
  dependencies?: number[];
  details?: string;
  status?: string;
  testStrategy?: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  details?: string;
  testStrategy?: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Subtask[];
}

interface TaskmasterJson {
  master: {
    tasks: Task[];
    metadata: any;
  };
}

// Helper to create issue body
function buildIssueBody(task: Task | Subtask, parentId?: number): string {
  let body = '';
  if ('details' in task && task.details) {
    body += `**Details:**\n${task.details}\n\n`;
  }
  if ('testStrategy' in task && task.testStrategy) {
    body += `**Test Strategy:**\n${task.testStrategy}\n\n`;
  }
  if ('status' in task && task.status) {
    body += `**Status:** ${task.status}\n\n`;
  }
  if ('priority' in task && (task as Task).priority) {
    body += `**Priority:** ${(task as Task).priority}\n\n`;
  }
  if (parentId !== undefined) {
    body += `**Parent Task ID:** ${parentId}\n\n`;
  }
  body += UNIQUE_MARKER;
  return body;
}

// Helper to find existing issue by title and marker
async function findExistingIssue(title: string): Promise<number | null> {
  const issues = await octokit.issues.listForRepo({
    owner: GITHUB_OWNER!,
    repo: GITHUB_REPO!,
    state: 'all',
    per_page: 100,
  });
  for (const issue of issues.data) {
    if (issue.title === title && issue.body && issue.body.includes(UNIQUE_MARKER)) {
      return issue.number;
    }
  }
  return null;
}

// Helper to create or get issue
async function createOrGetIssue(task: Task | Subtask, parentId?: number): Promise<number> {
  const title = task.title;
  const body = buildIssueBody(task, parentId);
  let issueNumber = await findExistingIssue(title);
  if (issueNumber) {
    console.log(`Issue already exists for: ${title} (#${issueNumber})`);
    return issueNumber;
  }
  const res = await octokit.issues.create({
    owner: GITHUB_OWNER!,
    repo: GITHUB_REPO!,
    title,
    body,
    labels: ['taskmaster'],
  });
  console.log(`Created issue: ${title} (#${res.data.number})`);
  return res.data.number;
}

// Helper to add sub-issue (GitHub Projects/Tasks API)
async function addSubIssue(parentIssueNumber: number, subIssueNumber: number) {
  // As of 2024, GitHub's sub-issue API is in beta and not in Octokit REST. Use issue linking as a fallback.
  await octokit.issues.createComment({
    owner: GITHUB_OWNER!,
    repo: GITHUB_REPO!,
    issue_number: parentIssueNumber,
    body: `Linked sub-issue: #${subIssueNumber}`,
  });
}

// Helper to update issue with dependency links
async function updateIssueWithDependencies(issueNumber: number, dependencyNumbers: number[]) {
  if (!dependencyNumbers.length) return;
  const { data: issue } = await octokit.issues.get({
    owner: GITHUB_OWNER!,
    repo: GITHUB_REPO!,
    issue_number: issueNumber,
  });
  let body = issue.body || '';
  // Remove old dependency section if present
  body = body.replace(/(\n)?---\n\*\*Dependencies:\*\*[\s\S]*?(?=\n---|$)/, '');
  // Add new dependency section
  const depSection = `\n---\n**Dependencies:**\n${dependencyNumbers.map(n => `- #${n}`).join('\n')}\n---`;
  body += depSection;
  await octokit.issues.update({
    owner: GITHUB_OWNER!,
    repo: GITHUB_REPO!,
    issue_number: issueNumber,
    body,
  });
  console.log(`Updated issue #${issueNumber} with dependencies.`);
}

async function main() {
  // 1. Parse JSON
  const raw = fs.readFileSync(TASKS_PATH, 'utf-8');
  const data: TaskmasterJson = JSON.parse(raw);
  const tasks = data.master.tasks;

  // 2. Create issues for all tasks and subtasks
  const idToIssueNumber: Record<string, number> = {};
  // First, create all parent tasks
  for (const task of tasks) {
    const issueNumber = await createOrGetIssue(task);
    idToIssueNumber[`${task.id}`] = issueNumber;
  }
  // Then, create all subtasks
  for (const task of tasks) {
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        const subId = `${task.id}.${sub.id}`;
        const issueNumber = await createOrGetIssue(sub, task.id);
        idToIssueNumber[subId] = issueNumber;
      }
    }
  }

  // 3. Link subtasks as sub-issues
  for (const task of tasks) {
    if (task.subtasks) {
      const parentIssueNumber = idToIssueNumber[`${task.id}`];
      for (const sub of task.subtasks) {
        const subId = `${task.id}.${sub.id}`;
        const subIssueNumber = idToIssueNumber[subId];
        await addSubIssue(parentIssueNumber, subIssueNumber);
      }
    }
  }

  // 4. Update issues with dependency links
  // For parent tasks
  for (const task of tasks) {
    if (task.dependencies && task.dependencies.length) {
      const depNumbers = task.dependencies.map(depId => idToIssueNumber[`${depId}`]).filter(Boolean);
      await updateIssueWithDependencies(idToIssueNumber[`${task.id}`], depNumbers);
    }
    // For subtasks
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        if (sub.dependencies && sub.dependencies.length) {
          // Subtask dependencies can be to parent tasks or other subtasks
          const subId = `${task.id}.${sub.id}`;
          const depNumbers = sub.dependencies.map(depId => {
            // Try subtask in same parent first
            const subDepId = `${task.id}.${depId}`;
            return idToIssueNumber[subDepId] || idToIssueNumber[`${depId}`];
          }).filter(Boolean);
          await updateIssueWithDependencies(idToIssueNumber[subId], depNumbers);
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