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
import { setupTaskmasterCli, getTaskmasterConfigFromInputs, runTaskmasterCli, validateTaskGraph } from './taskmaster-cli';
import { loadConfig, TaskmasterConfig } from '@scripts/index';

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
        additionalArgs: config.taskmasterArgs ? config.taskmasterArgs.split(' ').filter(arg => arg.trim()) : [],
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
        
      } else {
        throw new Error('Task graph was not generated by CLI');
      }

    } catch (error) {
      const errorMessage = `Failed to generate task graph: ${error instanceof Error ? error.message : String(error)}`;
      core.setFailed(errorMessage);
      throw error;
    }

    // TODO: Future enhancements
    // 2. Parse the generated task-graph.json for GitHub issue creation
    // 3. Create/update GitHub issues with hierarchy
    // 4. Upload artifact
    
    // Set placeholder outputs for now
    core.setOutput('issues-created', '0');
    
    core.info('✅ Taskmaster Generate completed successfully');
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();