/**
 * Taskmaster Generate Action
 * 
 * This action generates task graphs and GitHub issues from PRD files.
 * Triggered on push events to PRD files.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { DefaultArtifactClient } from '@actions/artifact';
import { setupTaskmasterCli, getTaskmasterConfigFromInputs, runTaskmasterCli, validateTaskGraph } from './taskmaster-cli';
import { loadConfig, TaskmasterConfig } from '../../../scripts/index';
import { createGitHubApiClient, EnhancedGitHubApi } from '../../../scripts/github-api';
import { components } from "@octokit/openapi-types";

// GitHub API types
type ApiIssue = components["schemas"]["issue"];
type Issue = ApiIssue & { expectedBody: string };
type ParentIssue = Issue & { subIssues: ApiIssue[] };

// Task interfaces
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
  // Added by app logic
  requiredBy?: Task[];
}

interface TaskGraph {
  tasks: Task[];
  metadata?: any;
}

const UNIQUE_MARKER = '<!-- created-by-taskmaster-script -->';

/**
 * Calculate task hierarchy depth recursively
 */
function calculateTaskHierarchyDepth(tasks: Task[]): number {
  let maxDepth = 0;
  
  for (const task of tasks) {
    let currentDepth = 1;
    if (task.subtasks && task.subtasks.length > 0) {
      currentDepth = 1 + calculateTaskHierarchyDepth(task.subtasks);
    }
    maxDepth = Math.max(maxDepth, currentDepth);
  }
  
  return maxDepth;
}

/**
 * Count leaf tasks (tasks without subtasks)
 */
function countLeafTasks(tasks: Task[]): number {
  let leafCount = 0;
  
  for (const task of tasks) {
    if (!task.subtasks || task.subtasks.length === 0) {
      leafCount++;
    } else {
      leafCount += countLeafTasks(task.subtasks);
    }
  }
  
  return leafCount;
}

/**
 * Count total tasks including subtasks
 */
function countTotalTasks(tasks: Task[]): number {
  let totalCount = tasks.length;
  
  for (const task of tasks) {
    if (task.subtasks && task.subtasks.length > 0) {
      totalCount += countTotalTasks(task.subtasks);
    }
  }
  
  return totalCount;
}

/**
 * Get artifact size validation
 */
function getArtifactSizeInfo(filePath: string): { sizeBytes: number; sizeKB: number; sizeMB: number } {
  const stats = fs.statSync(filePath);
  const sizeBytes = stats.size;
  return {
    sizeBytes,
    sizeKB: Math.round(sizeBytes / 1024 * 100) / 100,
    sizeMB: Math.round(sizeBytes / (1024 * 1024) * 100) / 100
  };
}

/**
 * Upload task graph as artifact with structured metadata
 */
async function uploadTaskGraphArtifact(
  taskGraphPath: string, 
  config: TaskmasterConfig,
  prdFilePath: string
): Promise<void> {
  core.info('📤 Uploading task graph as artifact with metadata...');
  
  try {
    // Read and parse task graph for metadata
    const taskGraphContent = fs.readFileSync(taskGraphPath, 'utf8');
    const taskGraph: TaskGraph = JSON.parse(taskGraphContent);
    
    // Get file size information
    const sizeInfo = getArtifactSizeInfo(taskGraphPath);
    
    // Calculate metadata
    const totalTasks = countTotalTasks(taskGraph.tasks || []);
    const leafTasksCount = countLeafTasks(taskGraph.tasks || []);
    const taskHierarchyDepth = calculateTaskHierarchyDepth(taskGraph.tasks || []);
    const generationTimestamp = new Date().toISOString();
    
    // Extract PRD version from file if possible
    let prdVersion = 'unknown';
    try {
      const prdContent = fs.readFileSync(prdFilePath, 'utf8');
      const versionMatch = prdContent.match(/version:\s*([^\n\r]+)/i);
      if (versionMatch) {
        prdVersion = versionMatch[1].trim();
      }
    } catch (error) {
      core.warning(`Could not extract PRD version: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Prepare metadata
    const metadata = {
      prd_version: prdVersion,
      generation_timestamp: generationTimestamp,
      complexity_threshold: config.complexityThreshold.toString(),
      max_depth: config.maxDepth.toString(),
      total_tasks: totalTasks.toString(),
      leaf_tasks_count: leafTasksCount.toString(),
      task_hierarchy_depth: taskHierarchyDepth.toString(),
      file_size_bytes: sizeInfo.sizeBytes.toString(),
      file_size_kb: sizeInfo.sizeKB.toString(),
      file_size_mb: sizeInfo.sizeMB.toString(),
      prd_file_path: prdFilePath
    };
    
    // Log metadata for transparency
    core.info('📊 Task Graph Metadata:');
    core.info(`  • PRD Version: ${metadata.prd_version}`);
    core.info(`  • Generation Timestamp: ${metadata.generation_timestamp}`);
    core.info(`  • Complexity Threshold: ${metadata.complexity_threshold}`);
    core.info(`  • Max Depth: ${metadata.max_depth}`);
    core.info(`  • Total Tasks: ${metadata.total_tasks}`);
    core.info(`  • Leaf Tasks Count: ${metadata.leaf_tasks_count}`);
    core.info(`  • Task Hierarchy Depth: ${metadata.task_hierarchy_depth}`);
    core.info(`  • File Size: ${sizeInfo.sizeMB} MB (${sizeInfo.sizeBytes} bytes)`);
    
    // Validate artifact size
    const maxSizeMB = 100; // GitHub artifact size limit consideration
    if (sizeInfo.sizeMB > maxSizeMB) {
      core.warning(`⚠️ Artifact size (${sizeInfo.sizeMB} MB) exceeds recommended limit of ${maxSizeMB} MB`);
    } else {
      core.info(`✅ Artifact size validation passed: ${sizeInfo.sizeMB} MB`);
    }
    
    // Create artifact client
    const artifactClient = new DefaultArtifactClient();
    
    // Upload artifact
    const artifactName = 'task-graph';
    const files = [taskGraphPath];
    const rootDirectory = path.dirname(taskGraphPath);
    
    const uploadResponse = await artifactClient.uploadArtifact(
      artifactName,
      files,
      rootDirectory,
      {
        retentionDays: 30 // Keep artifacts for 30 days
      }
    );
    
    // Log upload success
    core.info(`✅ Artifact upload successful:`);
    core.info(`  • Artifact Name: ${artifactName}`);
    core.info(`  • Files Uploaded: ${uploadResponse.size || 'unknown'} bytes`);
    core.info(`  • Upload ID: ${uploadResponse.id || 'unknown'}`);
    core.info(`  • Upload URL: Available in GitHub Actions UI`);
    
    // Set outputs for other steps
    if (uploadResponse.id) {
      core.setOutput('artifact-id', uploadResponse.id.toString());
    }
    core.setOutput('artifact-name', artifactName);
    if (uploadResponse.size) {
      core.setOutput('artifact-size', uploadResponse.size.toString());
    }
    
    // Export metadata as outputs for potential use by other actions
    Object.entries(metadata).forEach(([key, value]) => {
      core.setOutput(`metadata-${key.replace(/_/g, '-')}`, value);
    });
    
  } catch (error) {
    const errorMessage = `Failed to upload artifact: ${error instanceof Error ? error.message : String(error)}`;
    core.error(`❌ Artifact upload failed: ${errorMessage}`);
    core.setFailed(errorMessage);
    throw error;
  }
}

/**
 * Find PRD files matching the given glob pattern
 * Simple implementation using Node.js built-in functions
 */
function findPrdFiles(pattern: string): string[] {
  // For simplicity, support basic patterns like "docs/*.prd.md" or "*.prd.md"
  const basePath = process.cwd();
  const files: string[] = [];
  
  // Handle simple glob patterns
  if (pattern.includes('*')) {
    const parts = pattern.split('/');
    let currentPath = basePath;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part === '.' || part === '') {
        continue;
      }
      
      if (part.includes('*')) {
        // This is a wildcard part, scan the directory
        if (fs.existsSync(currentPath) && fs.statSync(currentPath).isDirectory()) {
          const entries = fs.readdirSync(currentPath);
          
          for (const entry of entries) {
            const entryPath = path.join(currentPath, entry);
            
            if (i === parts.length - 1) {
              // Last part, check if it matches the pattern and is a file
              if (fs.statSync(entryPath).isFile() && matchesPattern(entry, part)) {
                files.push(entryPath);
              }
            } else {
              // Not the last part, continue recursively if it's a directory
              if (fs.statSync(entryPath).isDirectory() && matchesPattern(entry, part)) {
                const remainingPattern = parts.slice(i + 1).join('/');
                const subFiles = findPrdFiles(path.join(entryPath, remainingPattern));
                files.push(...subFiles);
              }
            }
          }
        }
        break; // Stop processing after wildcard
      } else {
        // Regular directory name
        currentPath = path.join(currentPath, part);
      }
    }
  } else {
    // No wildcards, just check if the file exists
    const fullPath = path.resolve(basePath, pattern);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Simple pattern matching for basic wildcards
 */
function matchesPattern(filename: string, pattern: string): boolean {
  // Convert simple glob patterns to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
    
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}

/**
 * Helper to generate comprehensive labels for issues
 */
function generateIssueLabels(task: Task, parentTask?: Task, complexityScore?: number): string[] {
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
 * Helper to update issue labels based on dependency status
 */
function updateDependencyLabels(task: Task, dependencyIssues: Issue[] | undefined): string[] {
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

/**
 * Build YAML front-matter and issue body from task data
 */
function buildIssueBody(task: Task, parentIssue?: Issue): string {
  const yamlLines = [
    '---',
    `id: ${task.id}`,
    parentIssue ? `parent: ${parentIssue.number}` : '',
    task.dependencies && task.dependencies.length > 0 ? 
      `dependencies: [${task.dependencies.join(', ')}]` : '',
    '---'
  ].filter(line => line !== '');
  
  const yamlFrontMatter = yamlLines.join('\n') + '\n\n';

  let body = yamlFrontMatter;

  if (task.description) {
    body += `## Description\n\n${task.description}\n\n`;
  }

  if (task.details) {
    body += `## Details\n\n${task.details}\n\n`;
  }

  if (task.testStrategy) {
    body += `## Test Strategy\n\n${task.testStrategy}\n\n`;
  }

  if (task.dependencies && task.dependencies.length > 0) {
    body += `## Dependencies\n\n${task.dependencies.map(dep => `- [ ] Task #${dep}`).join('\n')}\n\n`;
  }

  const meta = [];
  if (task.status) meta.push(`- **Status**: \`${task.status}\``);
  if (task.priority) meta.push(`- **Priority**: \`${task.priority}\``);

  if (meta.length > 0) {
    body += `## Meta\n\n${meta.join('\n')}\n\n`;
  }

  body += UNIQUE_MARKER;
  return body;
}

/**
 * Update issue body with dependency links
 */
function updateIssueWithDependencies(body: string, dependencyIssues: Issue[]): string {
  if (!dependencyIssues?.length) return body;
  
  const depSection = `## Dependencies\n${dependencyIssues.map(i => 
    `- [${i.state === 'closed' ? 'x' : ' '}] #${i.number}`
  ).join('\n')}\n\n`;
  
  return body.replace(/## Dependencies[\s\S]+?\n\n/, depSection);
}

/**
 * Update issue body with required-by links
 */
function updateBodyWithRequiredBy(body: string, requiredByIssues: Issue[]): string {
  if (!requiredByIssues?.length) return body;
  
  const reqBySection = `## Required By\n${requiredByIssues.map(i => 
    `- [ ] #${i.number}`
  ).join('\n')}\n\n`;
  
  // Add before the UNIQUE_MARKER
  return body.replace(UNIQUE_MARKER, `${reqBySection}${UNIQUE_MARKER}`);
}

/**
 * Create or get an existing issue for a task
 */
async function createOrGetIssue(githubApi: EnhancedGitHubApi, task: Task, parentTask?: Task, parentIssue?: Issue): Promise<Issue> {
  const title = parentTask ? `[${parentTask.id}.${task.id}] ${task.title}` : `[${task.id}] ${task.title}`;
  
  // Check if issue already exists
  const existingIssue = await githubApi.findExistingIssue(title, UNIQUE_MARKER);
  
  if (existingIssue) {
    core.info(`Found existing issue #${existingIssue.number}: ${title}`);
    return {
      ...existingIssue,
      expectedBody: buildIssueBody(task, parentIssue)
    };
  }

  // Create new issue
  const body = buildIssueBody(task, parentIssue);
  const labels = generateIssueLabels(task, parentTask);
  
  core.info(`Creating issue: ${title}`);
  const newIssue = await githubApi.createIssue({
    title,
    body,
    labels
  });

  return {
    ...newIssue,
    expectedBody: body
  };
}

/**
 * Add a sub-issue relationship using GitHub's sub-issue API
 */
async function addSubIssue(githubApi: EnhancedGitHubApi, parentIssue: ParentIssue, subIssue: Issue): Promise<void> {
  try {
    // Try to add the sub-issue using GitHub's sub-issue API via the octokit client
    await githubApi.executeWithRetry(async () => {
      return await githubApi.client.request('PUT /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/{sub_issue_number}', {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: parentIssue.number,
        sub_issue_number: subIssue.number
      });
    }, 'add-sub-issue');
    
    core.info(`Added issue #${subIssue.number} as sub-issue of #${parentIssue.number}`);
  } catch (error) {
    core.warning(`Failed to add sub-issue relationship: ${error}`);
    // Fall back to just logging the relationship
    core.info(`Sub-issue relationship: #${parentIssue.number} -> #${subIssue.number}`);
  }
}

/**
 * Parse task graph and create GitHub issues
 */
async function parseTaskGraphAndCreateIssues(taskGraphPath: string, githubToken: string): Promise<number> {
  core.info('📋 Parsing task graph and creating GitHub issues...');
  
  // Read and parse task graph
  const taskGraphContent = fs.readFileSync(taskGraphPath, 'utf8');
  const taskGraph: TaskGraph = JSON.parse(taskGraphContent);
  
  if (!taskGraph.tasks || taskGraph.tasks.length === 0) {
    core.warning('No tasks found in task graph');
    return 0;
  }

  // Create GitHub API client
  const context = github.context;
  const githubApi = createGitHubApiClient({
    token: githubToken,
    owner: context.repo.owner,
    repo: context.repo.repo,
    maxConcurrent: 3,
    retryDelay: 1000,
    maxRetries: 3,
    debug: false
  });

  // Build required-by relationships
  const tasks = taskGraph.tasks;
  for (const task of tasks) {
    task.requiredBy = tasks.filter(t => t.dependencies?.includes(task.id));
    
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        sub.requiredBy = task.subtasks.filter(t => t.dependencies?.includes(sub.id));
      }
    }
  }

  const idToIssue: Record<string, Issue> = {};
  let issuesCreated = 0;

  // Create issues for main tasks first
  for (const task of tasks) {
    const issue = await createOrGetIssue(githubApi, task);
    idToIssue[String(task.id)] = issue;
    issuesCreated++;

    // Create issues for subtasks
    if (task.subtasks) {
      const parentIssue = issue as ParentIssue;
      parentIssue.subIssues = [];

      for (const sub of task.subtasks) {
        const subIssue = await createOrGetIssue(githubApi, sub, task, issue);
        idToIssue[`${task.id}.${sub.id}`] = subIssue;
        
        // Add to parent's sub-issues list
        parentIssue.subIssues.push(subIssue);
        
        // Try to create sub-issue relationship
        await addSubIssue(githubApi, parentIssue, subIssue);
        issuesCreated++;
      }
    }
  }

  // Update issues with dependency links and labels
  for (const task of tasks) {
    const issue = idToIssue[String(task.id)];
    
    const depIssues = task.dependencies?.map(depId => idToIssue[String(depId)]).filter(Boolean);
    if (depIssues?.length) {
      issue.expectedBody = updateIssueWithDependencies(issue.expectedBody, depIssues);
    }

    const reqByIssues = task.requiredBy?.map(reqBy => idToIssue[String(reqBy.id)]).filter(Boolean);
    if (reqByIssues?.length) {
      issue.expectedBody = updateBodyWithRequiredBy(issue.expectedBody, reqByIssues);
    }

    // Generate updated labels with dependency status
    const baseLabels = generateIssueLabels(task);
    const dependencyLabels = updateDependencyLabels(task, depIssues);
    const updatedLabels = [...baseLabels, ...dependencyLabels];

    // Update issue if needed
    const needsUpdate = issue.expectedBody !== issue.body;
    if (needsUpdate) {
      await githubApi.updateIssue(issue.number, {
        body: issue.expectedBody,
        labels: updatedLabels,
      });
      core.info(`Updated issue #${issue.number} with dependencies and labels.`);
    }

    // Update subtasks
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        const subIssue = idToIssue[`${task.id}.${sub.id}`];
        
        const subDepIssues = sub.dependencies?.map(depId => 
          idToIssue[`${task.id}.${depId}`] || idToIssue[String(depId)]
        ).filter(Boolean);
        
        if (subDepIssues?.length) {
          subIssue.expectedBody = updateIssueWithDependencies(subIssue.expectedBody, subDepIssues);
        }

        const subReqByIssues = sub.requiredBy?.map(reqBy => 
          idToIssue[`${task.id}.${reqBy.id}`]
        ).filter(Boolean);
        
        if (subReqByIssues?.length) {
          subIssue.expectedBody = updateBodyWithRequiredBy(subIssue.expectedBody, subReqByIssues);
        }

        const subBaseLabels = generateIssueLabels(sub, task);
        const subDependencyLabels = updateDependencyLabels(sub, subDepIssues);
        const subUpdatedLabels = [...subBaseLabels, ...subDependencyLabels];

        const subNeedsUpdate = subIssue.expectedBody !== subIssue.body;
        if (subNeedsUpdate) {
          await githubApi.updateIssue(subIssue.number, {
            body: subIssue.expectedBody,
            labels: subUpdatedLabels,
          });
          core.info(`Updated sub-issue #${subIssue.number} with dependencies and labels.`);
        }
      }
    }
  }

  // Wait for all pending API requests to complete
  await githubApi.waitForCompletion();
  const queueStatus = githubApi.getQueueStatus();
  core.info(`Final queue status: ${queueStatus.pending} pending, ${queueStatus.active} active`);

  // Clean up resources
  githubApi.destroy();

  core.info(`✅ Created/updated ${issuesCreated} GitHub issues`);
  return issuesCreated;
}

async function run(): Promise<void> {
  try {
    core.info('🚀 Starting Taskmaster Generate action');

    // Load configuration with priority: defaults < config files < env vars < action inputs
    const config = loadConfig(
      {
        validate: true,
        baseDir: process.cwd()
      },
      {
        // Action input overrides
        complexityThreshold: core.getInput('complexity-threshold') ? 
          parseInt(core.getInput('complexity-threshold'), 10) : undefined,
        maxDepth: core.getInput('max-depth') ? 
          parseInt(core.getInput('max-depth'), 10) : undefined,
        prdPathGlob: core.getInput('prd-path-glob') || undefined,
        taskmasterArgs: core.getInput('taskmaster-args') || undefined,
        githubToken: core.getInput('github-token') || undefined,
        taskmasterVersion: core.getInput('taskmaster-version') || undefined,
        taskmasterBaseUrl: core.getInput('taskmaster-base-url') || undefined,
        forceDownload: core.getInput('force-download') ? 
          core.getBooleanInput('force-download') : undefined
      }
    );

    core.info(`📋 Configuration loaded:`);
    core.info(`  • Complexity threshold: ${config.complexityThreshold}`);
    core.info(`  • Max depth: ${config.maxDepth}`);
    core.info(`  • PRD path glob: ${config.prdPathGlob}`);
    core.info(`  • Taskmaster version: ${config.taskmasterVersion}`);

    // Set up Taskmaster CLI binary with version pinning
    const taskmasterConfig = {
      version: config.taskmasterVersion,
      baseUrl: config.taskmasterBaseUrl,
      forceDownload: config.forceDownload
    };
    
    const binaryInfo = await setupTaskmasterCli(taskmasterConfig);
    
    core.info(`✅ Using Taskmaster CLI ${binaryInfo.version} at ${binaryInfo.binaryPath}`);

    // Find PRD files to process
    const prdFiles = findPrdFiles(config.prdPathGlob);
    
    if (prdFiles.length === 0) {
      core.warning(`No PRD files found matching pattern: ${config.prdPathGlob}`);
      core.setOutput('task-graph', '');
      core.setOutput('issues-created', '0');
      return;
    }

    core.info(`📁 Found ${prdFiles.length} PRD file(s) to process`);
    prdFiles.forEach(file => core.info(`   • ${file}`));

    // For now, process the first PRD file found
    // TODO: In the future, we might want to support multiple PRD files
    const prdFile = prdFiles[0];
    core.info(`🔄 Processing PRD file: ${prdFile}`);

    // Run Taskmaster CLI to generate task graph
    const taskGraphPath = path.join(process.cwd(), 'task-graph.json');
    
    try {
      const runResult = await runTaskmasterCli(binaryInfo, {
        prdPath: prdFile,
        complexityThreshold: config.complexityThreshold,
        maxDepth: config.maxDepth,
        outputPath: taskGraphPath,
        additionalArgs: config.taskmasterArgs ? config.taskmasterArgs.split(' ').filter((arg: string) => arg.trim()) : [],
        // Enhanced options for better reliability
        retryAttempts: 2,
        retryDelay: 1000,
        enableProgressMonitoring: true,
        gracefulShutdown: true,
        timeout: 300000 // 5 minutes
      });

      core.info(`✅ CLI execution completed with exit code: ${runResult.exitCode}`);
      core.info(`⏱️ Execution took ${Math.round(runResult.duration / 1000)}s over ${runResult.attemptsCount} attempt(s)`);
      
      // Validate the generated task graph
      if (runResult.taskGraphGenerated) {
        const isValid = validateTaskGraph(runResult.taskGraphPath);
        if (!isValid) {
          throw new Error('Generated task graph failed validation');
        }
        
        // Set outputs for other steps to use
        core.setOutput('task-graph', runResult.taskGraphPath);
        core.setOutput('task-graph-generated', 'true');
        
        // Read and log task graph summary
        const taskGraphContent = fs.readFileSync(runResult.taskGraphPath, 'utf8');
        const taskGraph = JSON.parse(taskGraphContent);
        const taskCount = taskGraph.tasks ? taskGraph.tasks.length : 0;
        core.info(`📊 Generated task graph with ${taskCount} tasks`);
        
        // Upload task graph as artifact with metadata
        try {
          await uploadTaskGraphArtifact(runResult.taskGraphPath, config, prdFile);
        } catch (artifactError) {
          // Log error but don't fail the entire action
          core.warning(`Artifact upload failed but continuing with issue creation: ${artifactError instanceof Error ? artifactError.message : String(artifactError)}`);
        }
        
        // Parse task graph and create GitHub issues
        const githubToken = config.githubToken;
        if (!githubToken) {
          throw new Error('GitHub token is required for issue creation');
        }
        
        const issuesCreated = await parseTaskGraphAndCreateIssues(runResult.taskGraphPath, githubToken);
        core.setOutput('issues-created', issuesCreated.toString());
        
      } else {
        throw new Error('Task graph was not generated by CLI');
      }

    } catch (error) {
      const errorMessage = `Failed to generate task graph: ${error instanceof Error ? error.message : String(error)}`;
      core.setFailed(errorMessage);
      throw error;
    }

    core.info('✅ Taskmaster Generate completed successfully');
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();