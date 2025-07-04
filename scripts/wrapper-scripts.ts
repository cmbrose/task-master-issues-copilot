/**
 * Wrapper script generation module
 * Creates platform-specific wrapper scripts for binary execution
 */

import * as fs from 'fs';
import * as path from 'path';
import { PlatformInfo, detectPlatform } from './platform-utils';

export interface WrapperScriptOptions {
  /** Binary path to wrap */
  binaryPath: string;
  /** Directory to place wrapper scripts */
  wrapperDir: string;
  /** Name for the wrapper script (defaults to 'taskmaster') */
  wrapperName?: string;
  /** Platform override (defaults to auto-detection) */
  platform?: PlatformInfo;
  /** Additional environment variables to set */
  envVars?: Record<string, string>;
}

export interface WrapperScriptInfo {
  /** Path to the generated wrapper script */
  wrapperPath: string;
  /** Name of the wrapper script */
  wrapperName: string;
  /** Platform the wrapper was created for */
  platform: PlatformInfo;
  /** Whether the wrapper is executable */
  isExecutable: boolean;
}

/**
 * Generate a platform-specific wrapper script
 */
export async function createWrapperScript(options: WrapperScriptOptions): Promise<WrapperScriptInfo> {
  const platform = options.platform || detectPlatform();
  const wrapperName = options.wrapperName || 'taskmaster';
  
  // Ensure wrapper directory exists
  if (!fs.existsSync(options.wrapperDir)) {
    fs.mkdirSync(options.wrapperDir, { recursive: true });
  }

  // Generate platform-specific wrapper
  const wrapperInfo = await generatePlatformWrapper(
    options.binaryPath,
    options.wrapperDir,
    wrapperName,
    platform,
    options.envVars || {}
  );

  return wrapperInfo;
}

/**
 * Generate wrapper script for specific platform
 */
async function generatePlatformWrapper(
  binaryPath: string,
  wrapperDir: string,
  wrapperName: string,
  platform: PlatformInfo,
  envVars: Record<string, string>
): Promise<WrapperScriptInfo> {
  let scriptContent: string;
  let scriptExtension: string;
  let wrapperPath: string;

  switch (platform.os) {
    case 'windows':
      scriptExtension = '.cmd';
      wrapperPath = path.join(wrapperDir, `${wrapperName}${scriptExtension}`);
      scriptContent = generateWindowsScript(binaryPath, envVars);
      break;
    
    case 'linux':
    case 'darwin':
      scriptExtension = '';
      wrapperPath = path.join(wrapperDir, wrapperName);
      scriptContent = generateUnixScript(binaryPath, envVars);
      break;
    
    default:
      throw new Error(`Unsupported platform: ${platform.os}`);
  }

  // Write wrapper script
  fs.writeFileSync(wrapperPath, scriptContent, { mode: 0o755 });

  // Set executable permissions (Unix-like systems)
  if (platform.os !== 'windows') {
    try {
      fs.chmodSync(wrapperPath, 0o755);
    } catch (error) {
      // Permissions may fail in some environments, continue
    }
  }

  return {
    wrapperPath,
    wrapperName: `${wrapperName}${scriptExtension}`,
    platform,
    isExecutable: await isWrapperExecutable(wrapperPath, platform)
  };
}

/**
 * Generate Windows batch/cmd script content
 */
function generateWindowsScript(binaryPath: string, envVars: Record<string, string>): string {
  const envSetters = Object.entries(envVars)
    .map(([key, value]) => `set "${key}=${value}"`)
    .join('\n');

  return `@echo off
rem Taskmaster CLI wrapper script for Windows
rem Generated automatically - do not edit manually

${envSetters ? envSetters + '\n' : ''}
rem Execute the binary with all arguments passed through
"${binaryPath}" %*
`;
}

/**
 * Generate Unix shell script content
 */
function generateUnixScript(binaryPath: string, envVars: Record<string, string>): string {
  const envExports = Object.entries(envVars)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');

  return `#!/bin/bash
# Taskmaster CLI wrapper script for Unix-like systems
# Generated automatically - do not edit manually

${envExports ? envExports + '\n' : ''}
# Execute the binary with all arguments passed through
exec "${binaryPath}" "$@"
`;
}

/**
 * Check if wrapper script is executable
 */
async function isWrapperExecutable(wrapperPath: string, platform: PlatformInfo): Promise<boolean> {
  try {
    if (platform.os === 'windows') {
      // On Windows, .cmd files are executable by default
      return fs.existsSync(wrapperPath);
    } else {
      // On Unix-like systems, check execute permission
      fs.accessSync(wrapperPath, fs.constants.X_OK);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Remove wrapper script
 */
export function removeWrapperScript(wrapperPath: string): void {
  try {
    if (fs.existsSync(wrapperPath)) {
      fs.unlinkSync(wrapperPath);
    }
  } catch (error) {
    // Ignore errors when removing wrapper scripts
  }
}

/**
 * Get wrapper script path for a binary
 */
export function getWrapperPath(
  wrapperDir: string,
  wrapperName: string = 'taskmaster',
  platform?: PlatformInfo
): string {
  const detectedPlatform = platform || detectPlatform();
  const extension = detectedPlatform.os === 'windows' ? '.cmd' : '';
  return path.join(wrapperDir, `${wrapperName}${extension}`);
}

/**
 * Check if wrapper script exists
 */
export function wrapperExists(
  wrapperDir: string,
  wrapperName: string = 'taskmaster',
  platform?: PlatformInfo
): boolean {
  const wrapperPath = getWrapperPath(wrapperDir, wrapperName, platform);
  return fs.existsSync(wrapperPath);
}

/**
 * Add wrapper directory to PATH environment variable
 */
export function addToPath(wrapperDir: string): string {
  const currentPath = process.env.PATH || '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  
  // Check if directory is already in PATH
  const pathDirs = currentPath.split(pathSeparator);
  if (pathDirs.includes(wrapperDir)) {
    return currentPath;
  }
  
  // Add wrapper directory to beginning of PATH
  return wrapperDir + pathSeparator + currentPath;
}

/**
 * Setup PATH environment to include wrapper directory
 */
export function setupWrapperEnvironment(wrapperDir: string): void {
  process.env.PATH = addToPath(wrapperDir);
}