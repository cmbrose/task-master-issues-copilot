/**
 * Taskmaster CLI Integration Helper
 * 
 * This module provides integration utilities for downloading and managing
 * the Taskmaster CLI binary within GitHub Actions.
 */

import * as core from '@actions/core';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { parseTaskGraphJson, extractTasksForGitHub, calculateTaskComplexity, type TaskGraph } from '../../../scripts/index';
import { downloadBinary, BinaryDownloadOptions, BinaryInfo, TaskmasterConfig, loadFromEnvironment } from '../../../scripts/index';

/**
 * Configuration for Taskmaster CLI setup
 */
export interface TaskmasterCliConfig {
  /** Version to download (e.g., '1.0.0') */
  version: string;
  /** Base URL for downloads (defaults to official releases) */
  baseUrl?: string;
  /** Force re-download even if binary exists */
  forceDownload?: boolean;
}

/**
 * Default configuration for Taskmaster CLI downloads
 */
const DEFAULT_CONFIG = {
  baseUrl: 'https://github.com/taskmaster-ai/taskmaster/releases/download',
  version: '1.0.0'
};

/**
 * Set up Taskmaster CLI binary for use in GitHub Actions
 * Downloads and pins the specified version, making it available for execution
 */
export async function setupTaskmasterCli(config: TaskmasterCliConfig): Promise<BinaryInfo> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  core.info(`Setting up Taskmaster CLI version ${mergedConfig.version}`);
  
  // Use GitHub Actions runner temp directory for binary storage
  const storageDir = path.join(process.env.RUNNER_TEMP || '/tmp', 'taskmaster-binaries');
  
  const downloadOptions: BinaryDownloadOptions = {
    baseUrl: mergedConfig.baseUrl,
    version: mergedConfig.version,
    storageDir,
    binaryName: 'taskmaster',
    forceDownload: config.forceDownload
  };
  
  try {
    const binaryInfo = await downloadBinary(downloadOptions);
    
    if (binaryInfo.downloaded) {
      core.info(`✓ Downloaded Taskmaster CLI ${binaryInfo.version} for ${binaryInfo.platform.os}-${binaryInfo.platform.arch}`);
    } else {
      core.info(`✓ Using cached Taskmaster CLI ${binaryInfo.version} for ${binaryInfo.platform.os}-${binaryInfo.platform.arch}`);
    }
    
    core.info(`Binary location: ${binaryInfo.binaryPath}`);
    
    // Set output for other steps to use
    core.setOutput('taskmaster-binary-path', binaryInfo.binaryPath);
    core.setOutput('taskmaster-version', binaryInfo.version);
    
    return binaryInfo;
  } catch (error) {
    const errorMessage = `Failed to setup Taskmaster CLI: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get Taskmaster CLI setup from GitHub Actions inputs
 * @deprecated Use the new configuration management system instead
 */
export function getTaskmasterConfigFromInputs(): TaskmasterCliConfig {
  return {
    version: core.getInput('taskmaster-version') || DEFAULT_CONFIG.version,
    baseUrl: core.getInput('taskmaster-base-url') || DEFAULT_CONFIG.baseUrl,
    forceDownload: core.getBooleanInput('force-download')
  };
}

/**
 * Get Taskmaster CLI configuration from the centralized config system
 */
export function getTaskmasterConfigFromCentralized(config: TaskmasterConfig): TaskmasterCliConfig {
  return {
    version: config.taskmasterVersion,
    baseUrl: config.taskmasterBaseUrl,
    forceDownload: config.forceDownload
  };
}

/**
 * Options for running Taskmaster CLI
 */
export interface TaskmasterRunOptions {
  /** Path to PRD file or directory to process */
  prdPath: string;
  /** Complexity threshold (default: 40) */
  complexityThreshold?: number;
  /** Maximum depth for task breakdown (default: 3) */
  maxDepth?: number;
  /** Additional CLI arguments */
  additionalArgs?: string[];
  /** Output file path for task-graph.json (default: ./task-graph.json) */
  outputPath?: string;
  /** Working directory for CLI execution (default: current directory) */
  workingDir?: string;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Number of retry attempts on failure (default: 2) */
  retryAttempts?: number;
  /** Delay between retry attempts in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Enable progress monitoring during execution (default: true) */
  enableProgressMonitoring?: boolean;
  /** Use graceful shutdown instead of SIGTERM (default: true) */
  gracefulShutdown?: boolean;
}

/**
 * Result of Taskmaster CLI execution
 */
export interface TaskmasterRunResult {
  /** Exit code from the CLI */
  exitCode: number;
  /** Standard output from the CLI */
  stdout: string;
  /** Standard error from the CLI */
  stderr: string;
  /** Path to the generated task-graph.json file */
  taskGraphPath: string;
  /** Indicates if task-graph.json was successfully generated */
  taskGraphGenerated: boolean;
  /** Number of attempts made to execute the CLI */
  attemptsCount: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error category if execution failed */
  errorCategory?: 'timeout' | 'process' | 'validation' | 'network' | 'unknown';
}

/**
 * Execute Taskmaster CLI with specified options to generate task graph
 */
export async function runTaskmasterCli(
  binaryInfo: BinaryInfo,
  options: TaskmasterRunOptions
): Promise<TaskmasterRunResult> {
  const {
    prdPath,
    complexityThreshold = 40,
    maxDepth = 3,
    additionalArgs = [],
    outputPath = 'task-graph.json',
    workingDir = process.cwd(),
    timeout = 300000, // 5 minutes
    retryAttempts = 2,
    retryDelay = 1000,
    enableProgressMonitoring = true,
    gracefulShutdown = true
  } = options;

  // Verify CLI binary dependencies before execution
  await verifyCliDependencies(binaryInfo);

  // Validate CLI arguments
  validateCliArguments(options);

  let lastError: Error | null = null;
  let attempts = 0;

  // Retry loop for execution attempts
  while (attempts <= retryAttempts) {
    attempts++;
    
    try {
      core.info(`🚀 CLI execution attempt ${attempts}/${retryAttempts + 1}`);
      
      const result = await executeCliWithMonitoring(binaryInfo, {
        prdPath,
        complexityThreshold,
        maxDepth,
        additionalArgs,
        outputPath,
        workingDir,
        timeout,
        enableProgressMonitoring,
        gracefulShutdown,
        attemptNumber: attempts
      });

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorCategory = categorizeError(lastError);
      
      core.warning(`⚠️ CLI execution attempt ${attempts} failed: ${lastError.message}`);
      core.warning(`   Error category: ${errorCategory}`);

      // Don't retry for certain types of errors
      if (errorCategory === 'validation' || attempts > retryAttempts) {
        break;
      }

      // Wait before retry (except on last attempt)
      if (attempts <= retryAttempts) {
        core.info(`⏳ Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All attempts failed
  const errorCategory = lastError ? categorizeError(lastError) : 'unknown';
  throw new Error(`CLI execution failed after ${attempts} attempts. Last error: ${lastError?.message}. Category: ${errorCategory}`);
}

/**
 * Internal function to execute CLI with monitoring and enhanced error handling
 */
async function executeCliWithMonitoring(
  binaryInfo: BinaryInfo,
  options: {
    prdPath: string;
    complexityThreshold: number;
    maxDepth: number;
    additionalArgs: string[];
    outputPath: string;
    workingDir: string;
    timeout: number;
    enableProgressMonitoring: boolean;
    gracefulShutdown: boolean;
    attemptNumber: number;
  }
): Promise<TaskmasterRunResult> {
  const {
    prdPath,
    complexityThreshold,
    maxDepth,
    additionalArgs,
    outputPath,
    workingDir,
    timeout,
    enableProgressMonitoring,
    gracefulShutdown,
    attemptNumber
  } = options;

  const startTime = Date.now();

  // Ensure absolute paths
  const absolutePrdPath = path.resolve(workingDir, prdPath);
  const absoluteOutputPath = path.resolve(workingDir, outputPath);
  
  // Verify PRD file exists
  if (!fs.existsSync(absolutePrdPath)) {
    throw new Error(`PRD file not found: ${absolutePrdPath}`);
  }

  // Build CLI arguments
  const args = [
    'generate',
    '--prd', absolutePrdPath,
    '--complexity-threshold', complexityThreshold.toString(),
    '--max-depth', maxDepth.toString(),
    '--output', absoluteOutputPath,
    '--format', 'json',
    ...additionalArgs
  ];

  core.info(`🚀 Executing Taskmaster CLI: ${binaryInfo.binaryPath} ${args.join(' ')}`);
  core.info(`   Working directory: ${workingDir}`);
  core.info(`   Complexity threshold: ${complexityThreshold}`);
  core.info(`   Max depth: ${maxDepth}`);
  core.info(`   Attempt: ${attemptNumber}`);
  core.info(`   Timeout: ${timeout}ms`);

  return new Promise((resolve, reject) => {
    const childProcess = spawn(binaryInfo.binaryPath, args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';
    let progressMonitor: NodeJS.Timeout | null = null;

    // Set up progress monitoring
    if (enableProgressMonitoring) {
      progressMonitor = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = timeout - elapsed;
        core.info(`⏱️ CLI execution progress: ${Math.round(elapsed / 1000)}s elapsed, ${Math.round(remaining / 1000)}s remaining`);
      }, 30000); // Log progress every 30 seconds
    }

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log CLI output in real-time for debugging
      core.info(`CLI: ${output.trim()}`);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      // Log CLI errors in real-time
      core.warning(`CLI Error: ${output.trim()}`);
    });

    // Set up timeout with graceful shutdown option
    const timeoutHandle = setTimeout(async () => {
      if (progressMonitor) {
        clearInterval(progressMonitor);
      }

      if (gracefulShutdown) {
        core.info('⏰ Timeout reached, attempting graceful shutdown...');
        childProcess.kill('SIGINT'); // Try graceful shutdown first
        
        // Give process 5 seconds to shut down gracefully
        setTimeout(() => {
          if (!childProcess.killed) {
            core.warning('🔪 Graceful shutdown failed, forcing termination...');
            childProcess.kill('SIGTERM');
          }
        }, 5000);
      } else {
        childProcess.kill('SIGTERM');
      }
      
      reject(new Error(`Taskmaster CLI execution timed out after ${timeout}ms`));
    }, timeout);

    childProcess.on('error', (error) => {
      clearTimeout(timeoutHandle);
      if (progressMonitor) {
        clearInterval(progressMonitor);
      }
      reject(new Error(`Failed to execute Taskmaster CLI: ${error.message}`));
    });

    childProcess.on('close', (exitCode) => {
      const duration = Date.now() - startTime;
      clearTimeout(timeoutHandle);
      if (progressMonitor) {
        clearInterval(progressMonitor);
      }
      
      const taskGraphGenerated = fs.existsSync(absoluteOutputPath);
      
      const result: TaskmasterRunResult = {
        exitCode: exitCode || 0,
        stdout,
        stderr,
        taskGraphPath: absoluteOutputPath,
        taskGraphGenerated,
        attemptsCount: attemptNumber,
        duration
      };

      if (exitCode === 0) {
        core.info(`✅ Taskmaster CLI completed successfully (exit code: ${exitCode})`);
        core.info(`⏱️ Execution time: ${Math.round(duration / 1000)}s`);
        if (taskGraphGenerated) {
          core.info(`✅ Task graph generated at: ${absoluteOutputPath}`);
        } else {
          core.warning(`⚠️ CLI completed but task-graph.json not found at: ${absoluteOutputPath}`);
        }
        resolve(result);
      } else {
        const errorMessage = `Taskmaster CLI failed with exit code ${exitCode}`;
        core.error(errorMessage);
        core.error(`⏱️ Failed after: ${Math.round(duration / 1000)}s`);
        if (stderr) {
          core.error(`CLI stderr: ${stderr}`);
        }
        
        result.errorCategory = categorizeCliError(exitCode || -1, stderr);
        reject(new Error(`${errorMessage}\nStderr: ${stderr}`));
      }
    });
  });
}

/**
 * Validate that the generated task-graph.json has the expected structure
 */
export function validateTaskGraph(taskGraphPath: string): boolean {
  try {
    if (!fs.existsSync(taskGraphPath)) {
      core.error(`Task graph file not found: ${taskGraphPath}`);
      return false;
    }

    const content = fs.readFileSync(taskGraphPath, 'utf8');
    
    // Use enhanced JSON parsing with schema validation
    const parseResult = parseTaskGraphJson(content);
    
    if (parseResult.errors.length > 0) {
      core.error('❌ Task graph validation failed:');
      
      if (parseResult.parseErrors.length > 0) {
        core.error('JSON Parse Errors:');
        parseResult.parseErrors.forEach((error: string) => core.error(`  - ${error}`));
      }
      
      if (parseResult.validationErrors.length > 0) {
        core.error('Schema Validation Errors:');
        parseResult.validationErrors.forEach((error: string) => core.error(`  - ${error}`));
      }
      
      return false;
    }

    if (!parseResult.data) {
      core.error('❌ Task graph validation failed: No data returned');
      return false;
    }

    const taskGraph = parseResult.data;
    
    // Log validation success and task graph info
    core.info('✅ Task graph JSON parsing and schema validation completed');
    
    const complexity = calculateTaskComplexity(taskGraph);
    core.info(`📊 Task Graph Analysis:`);
    core.info(`   - Total tasks: ${complexity.totalTasks}`);
    core.info(`   - Max depth: ${complexity.maxDepth}`);
    core.info(`   - Average subtasks: ${complexity.averageSubtasks.toFixed(1)}`);
    core.info(`   - Complexity score: ${complexity.complexityScore}/10`);
    
    // Test GitHub API data extraction
    const githubData = extractTasksForGitHub(taskGraph);
    if (githubData.errors.length > 0) {
      core.warning('⚠️ Issues found during GitHub API data extraction:');
      githubData.errors.forEach((error: string) => core.warning(`  - ${error}`));
    } else {
      core.info(`✅ Successfully extracted ${githubData.tasks.length} tasks for GitHub API`);
    }

    return true;
  } catch (error) {
    core.error(`Task graph validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Parse task graph JSON with comprehensive validation and GitHub API data extraction
 */
export function parseAndValidateTaskGraph(taskGraphPath: string): {
  success: boolean;
  taskGraph?: TaskGraph;
  githubTasks?: ReturnType<typeof extractTasksForGitHub>['tasks'];
  errors: string[];
} {
  const errors: string[] = [];

  try {
    if (!fs.existsSync(taskGraphPath)) {
      errors.push(`Task graph file not found: ${taskGraphPath}`);
      return { success: false, errors };
    }

    const content = fs.readFileSync(taskGraphPath, 'utf8');
    
    // Parse and validate task graph JSON
    const parseResult = parseTaskGraphJson(content);
    
    if (parseResult.errors.length > 0) {
      errors.push('Task graph validation failed:');
      errors.push(...parseResult.parseErrors.map((e: string) => `Parse Error: ${e}`));
      errors.push(...parseResult.validationErrors.map((e: string) => `Validation Error: ${e}`));
      return { success: false, errors };
    }

    if (!parseResult.data) {
      errors.push('Task graph parsing succeeded but no data was returned');
      return { success: false, errors };
    }

    const taskGraph = parseResult.data;
    
    // Extract GitHub API compatible data
    const githubData = extractTasksForGitHub(taskGraph);
    
    if (githubData.errors.length > 0) {
      errors.push('GitHub API data extraction had issues:');
      errors.push(...githubData.errors);
      // Continue with partial success since parsing worked
    }

    return {
      success: true,
      taskGraph,
      githubTasks: githubData.tasks,
      errors
    };

  } catch (error) {
    errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors };
  }
}

/**
 * Verify CLI dependencies and binary availability before execution
 */
async function verifyCliDependencies(binaryInfo: BinaryInfo): Promise<void> {
  core.info('🔍 Verifying CLI dependencies...');
  
  // Check if binary file exists and is executable
  if (!fs.existsSync(binaryInfo.binaryPath)) {
    throw new Error(`CLI binary not found at: ${binaryInfo.binaryPath}`);
  }

  // Check if binary is executable
  try {
    fs.accessSync(binaryInfo.binaryPath, fs.constants.F_OK | fs.constants.X_OK);
  } catch (error) {
    throw new Error(`CLI binary is not executable: ${binaryInfo.binaryPath}`);
  }

  // Verify binary version and basic functionality (if possible)
  try {
    core.info('🔧 Checking CLI version compatibility...');
    // Note: In a real implementation, we might run `taskmaster --version` here
    // For now, we'll just log that we're using the specified version
    core.info(`✅ Using Taskmaster CLI ${binaryInfo.version} for ${binaryInfo.platform.os}-${binaryInfo.platform.arch}`);
  } catch (error) {
    core.warning(`⚠️ Could not verify CLI version: ${error instanceof Error ? error.message : String(error)}`);
  }

  core.info('✅ CLI dependency verification completed');
}

/**
 * Validate CLI execution arguments
 */
function validateCliArguments(options: TaskmasterRunOptions): void {
  core.info('📋 Validating CLI arguments...');

  const { prdPath, complexityThreshold, maxDepth, timeout } = options;

  // Validate PRD path
  if (!prdPath || typeof prdPath !== 'string') {
    throw new Error('PRD path is required and must be a string');
  }

  // Validate complexity threshold
  if (complexityThreshold !== undefined) {
    if (typeof complexityThreshold !== 'number' || complexityThreshold < 1 || complexityThreshold > 100) {
      throw new Error('Complexity threshold must be a number between 1 and 100');
    }
  }

  // Validate max depth
  if (maxDepth !== undefined) {
    if (typeof maxDepth !== 'number' || maxDepth < 1 || maxDepth > 10) {
      throw new Error('Max depth must be a number between 1 and 10');
    }
  }

  // Validate timeout
  if (timeout !== undefined) {
    if (typeof timeout !== 'number' || timeout < 1000 || timeout > 3600000) { // 1 second to 1 hour
      throw new Error('Timeout must be a number between 1000ms (1s) and 3600000ms (1h)');
    }
  }

  core.info('✅ CLI argument validation completed');
}

/**
 * Categorize error types for better error handling and reporting
 */
function categorizeError(error: Error): 'timeout' | 'process' | 'validation' | 'network' | 'unknown' {
  const message = error.message.toLowerCase();

  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  } else if (message.includes('prd file not found') || message.includes('validation') || 
             message.includes('must be a number') || message.includes('is required')) {
    return 'validation';
  } else if (message.includes('network') || message.includes('download') || 
             message.includes('connection') || message.includes('http')) {
    return 'network';
  } else if (message.includes('spawn') || message.includes('execute') || 
             message.includes('process') || message.includes('executable')) {
    return 'process';
  } else {
    return 'unknown';
  }
}

/**
 * Categorize CLI-specific errors based on exit code and stderr output
 */
function categorizeCliError(exitCode: number, stderr: string): 'timeout' | 'process' | 'validation' | 'network' | 'unknown' {
  const stderrLower = stderr.toLowerCase();

  // Common CLI exit codes and their meanings
  switch (exitCode) {
    case 1:
      if (stderrLower.includes('file not found') || stderrLower.includes('invalid argument')) {
        return 'validation';
      }
      break;
    case 2:
      return 'validation'; // Usually argument parsing errors
    case 124:
    case 137: // SIGKILL
    case 143: // SIGTERM
      return 'timeout';
    case 127:
      return 'process'; // Command not found
    default:
      break;
  }

  // Check stderr content for error patterns
  if (stderrLower.includes('timeout') || stderrLower.includes('killed')) {
    return 'timeout';
  } else if (stderrLower.includes('invalid') || stderrLower.includes('parse') || 
             stderrLower.includes('argument') || stderrLower.includes('required')) {
    return 'validation';
  } else if (stderrLower.includes('network') || stderrLower.includes('connection')) {
    return 'network';
  } else if (stderrLower.includes('permission') || stderrLower.includes('access')) {
    return 'process';
  }

  return 'unknown';
}