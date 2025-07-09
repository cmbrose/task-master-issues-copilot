/**
 * Platform utilities for detecting OS and architecture
 * Used by binary downloader to select appropriate binaries
 */

export interface PlatformInfo {
  os: 'linux' | 'windows' | 'darwin';
  arch: 'x64' | 'arm64';
  extension: string;
}

/**
 * Detect the current platform and architecture
 */
export function detectPlatform(): PlatformInfo {
  const platform = process.platform;
  const arch = process.arch;

  let os: PlatformInfo['os'];
  let detectedArch: PlatformInfo['arch'];
  let extension: string;

  // Map Node.js platform to our OS types
  switch (platform) {
    case 'linux':
      os = 'linux';
      extension = '';
      break;
    case 'win32':
      os = 'windows';
      extension = '.exe';
      break;
    case 'darwin':
      os = 'darwin';
      extension = '';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  // Map Node.js arch to our architecture types
  switch (arch) {
    case 'x64':
      detectedArch = 'x64';
      break;
    case 'arm64':
      detectedArch = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return {
    os,
    arch: detectedArch,
    extension
  };
}

/**
 * Generate binary filename for a platform
 */
export function getBinaryName(platform: PlatformInfo, baseName: string = 'taskmaster'): string {
  return `${baseName}-${platform.os}-${platform.arch}${platform.extension}`;
}

/**
 * Generate download URL for a binary
 */
export function getBinaryDownloadUrl(
  baseUrl: string,
  version: string,
  platform: PlatformInfo,
  baseName: string = 'taskmaster'
): string {
  const binaryName = getBinaryName(platform, baseName);
  return `${baseUrl}/v${version}/${binaryName}`;
}

/**
 * Format error message consistently across the codebase
 * Handles both Error objects and unknown error types
 */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}