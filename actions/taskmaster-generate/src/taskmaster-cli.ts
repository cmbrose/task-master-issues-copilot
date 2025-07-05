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
    timeout = 300000 // 5 minutes
  } = options;

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

  return new Promise((resolve, reject) => {
    const childProcess = spawn(binaryInfo.binaryPath, args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

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

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error(`Taskmaster CLI execution timed out after ${timeout}ms`));
    }, timeout);

    childProcess.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to execute Taskmaster CLI: ${error.message}`));
    });

    childProcess.on('close', (exitCode) => {
      clearTimeout(timeoutHandle);
      
      const taskGraphGenerated = fs.existsSync(absoluteOutputPath);
      
      const result: TaskmasterRunResult = {
        exitCode: exitCode || 0,
        stdout,
        stderr,
        taskGraphPath: absoluteOutputPath,
        taskGraphGenerated
      };

      if (exitCode === 0) {
        core.info(`✅ Taskmaster CLI completed successfully (exit code: ${exitCode})`);
        if (taskGraphGenerated) {
          core.info(`✅ Task graph generated at: ${absoluteOutputPath}`);
        } else {
          core.warning(`⚠️ CLI completed but task-graph.json not found at: ${absoluteOutputPath}`);
        }
        resolve(result);
      } else {
        const errorMessage = `Taskmaster CLI failed with exit code ${exitCode}`;
        core.error(errorMessage);
        if (stderr) {
          core.error(`CLI stderr: ${stderr}`);
        }
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
    const taskGraph = JSON.parse(content);

    // Basic validation of expected structure
    if (!taskGraph || typeof taskGraph !== 'object') {
      core.error('Task graph is not a valid JSON object');
      return false;
    }

    // Check for essential properties (adjust based on actual Taskmaster CLI output)
    const requiredFields = ['tasks', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in taskGraph)) {
        core.warning(`Task graph missing expected field: ${field}`);
      }
    }

    core.info('✅ Task graph validation completed');
    return true;
  } catch (error) {
    core.error(`Task graph validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}