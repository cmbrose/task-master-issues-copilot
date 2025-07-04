/**
 * Taskmaster CLI Integration Helper
 * 
 * This module provides integration utilities for downloading and managing
 * the Taskmaster CLI binary within GitHub Actions.
 */

import * as core from '@actions/core';
import * as path from 'path';
import { downloadBinary, BinaryDownloadOptions, BinaryInfo, TaskmasterConfig, loadFromEnvironment } from '@scripts/index';

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
 * Example usage function showing how to integrate with an action
 */
export async function exampleIntegration(): Promise<void> {
  try {
    // Get configuration from action inputs
    const config = getTaskmasterConfigFromInputs();
    
    // Setup the CLI binary
    const binaryInfo = await setupTaskmasterCli(config);
    
    // Now the binary is ready to use
    core.info(`Taskmaster CLI ready at: ${binaryInfo.binaryPath}`);
    
    // In a real action, you would now execute the binary:
    // const { spawn } = require('child_process');
    // const result = spawn(binaryInfo.binaryPath, ['parse-prd', 'docs/example.prd.md']);
    
  } catch (error) {
    core.setFailed(`Integration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}