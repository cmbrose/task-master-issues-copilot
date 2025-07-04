/**
 * Binary downloader and version pinning module
 * Handles downloading the Taskmaster CLI binary from remote sources
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { detectPlatform, getBinaryDownloadUrl, PlatformInfo } from './platform-utils';

export interface BinaryDownloadOptions {
  /** Base URL for binary downloads (e.g., 'https://github.com/owner/repo/releases/download') */
  baseUrl: string;
  /** Version to download (e.g., '1.0.0') */
  version: string;
  /** Directory to store the binary */
  storageDir: string;
  /** Binary name (defaults to 'taskmaster') */
  binaryName?: string;
  /** Platform override (defaults to auto-detection) */
  platform?: PlatformInfo;
  /** Force re-download even if binary exists */
  forceDownload?: boolean;
  /** Checksum validation options */
  checksum?: ChecksumOptions;
}

export interface ChecksumOptions {
  /** Expected checksum value */
  value?: string;
  /** Hash algorithm to use (defaults to 'sha256') */
  algorithm?: 'sha256' | 'sha512';
  /** URL to retrieve checksum from (alternative to providing value directly) */
  url?: string;
}

export interface BinaryInfo {
  /** Path to the downloaded binary */
  binaryPath: string;
  /** Version of the binary */
  version: string;
  /** Platform information */
  platform: PlatformInfo;
  /** Whether the binary was newly downloaded */
  downloaded: boolean;
  /** Checksum verification result */
  checksumVerified?: boolean;
}

/**
 * Calculate checksum of a file using the specified algorithm
 */
async function calculateChecksum(filePath: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (error) => {
      reject(new Error(`Failed to calculate checksum for ${filePath}: ${error.message}`));
    });
  });
}

/**
 * Retrieve checksum from a remote URL
 */
async function retrieveRemoteChecksum(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;

    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          retrieveRemoteChecksum(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to retrieve checksum from ${url}: HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        // Extract checksum from response (assume it's the first hash-like string)
        const checksumMatch = data.trim().match(/^([a-fA-F0-9]{64,128})/);
        if (checksumMatch) {
          resolve(checksumMatch[1].toLowerCase());
        } else {
          reject(new Error(`Invalid checksum format from ${url}: ${data.slice(0, 100)}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Failed to retrieve checksum from ${url}: ${error.message}`));
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout retrieving checksum from ${url}`));
    });
  });
}

/**
 * Verify checksum of a downloaded binary
 */
async function verifyChecksum(
  filePath: string, 
  checksumOptions: ChecksumOptions
): Promise<void> {
  const algorithm = checksumOptions.algorithm || 'sha256';
  let expectedChecksum: string;

  // Get expected checksum value
  if (checksumOptions.value) {
    expectedChecksum = checksumOptions.value.toLowerCase();
  } else if (checksumOptions.url) {
    expectedChecksum = await retrieveRemoteChecksum(checksumOptions.url);
  } else {
    throw new Error('Checksum validation requested but no checksum value or URL provided');
  }

  // Calculate actual checksum
  const actualChecksum = await calculateChecksum(filePath, algorithm);

  // Secure comparison to prevent timing attacks
  if (!secureCompare(expectedChecksum, actualChecksum)) {
    throw new Error(
      `Checksum verification failed for ${filePath}. ` +
      `Expected: ${expectedChecksum}, Got: ${actualChecksum} (${algorithm})`
    );
  }
}

/**
 * Secure string comparison to prevent timing attacks
 */
function secureCompare(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Download a binary from a URL to a local file
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https:') ? https : http;

    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        // Make binary executable on Unix-like systems
        if (process.platform !== 'win32') {
          fs.chmodSync(destPath, '755');
        }
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Clean up on error
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Clean up on error
      reject(err);
    });
  });
}

/**
 * Check if a binary file exists and is executable
 */
function binaryExists(binaryPath: string): boolean {
  try {
    const stats = fs.statSync(binaryPath);
    if (!stats.isFile()) {
      return false;
    }

    // Check if file is executable (on Unix-like systems)
    if (process.platform !== 'win32') {
      fs.accessSync(binaryPath, fs.constants.X_OK);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Download and pin a specific version of a binary
 */
export async function downloadBinary(options: BinaryDownloadOptions): Promise<BinaryInfo> {
  const platform = options.platform || detectPlatform();
  const binaryName = options.binaryName || 'taskmaster';
  
  // Generate binary filename with version for storage
  const versionedBinaryName = `${binaryName}-${options.version}-${platform.os}-${platform.arch}${platform.extension}`;
  const binaryPath = path.join(options.storageDir, versionedBinaryName);

  // Check if binary already exists and is valid
  if (!options.forceDownload && binaryExists(binaryPath)) {
    let checksumVerified: boolean | undefined;
    
    // Verify checksum of existing binary if checksum options provided
    if (options.checksum) {
      try {
        await verifyChecksum(binaryPath, options.checksum);
        checksumVerified = true;
      } catch (error) {
        // If checksum verification fails for existing binary, re-download
        if (error instanceof Error && error.message.includes('Checksum verification failed')) {
          // Fall through to download section
          checksumVerified = false;
        } else {
          throw error;
        }
      }
    }

    // Return if we successfully verified the existing binary or no checksum was requested
    if (checksumVerified === true || checksumVerified === undefined) {
      return {
        binaryPath,
        version: options.version,
        platform,
        downloaded: false,
        checksumVerified
      };
    }
  }

  // Generate download URL
  const downloadUrl = getBinaryDownloadUrl(options.baseUrl, options.version, platform, binaryName);

  // Download the binary
  try {
    await downloadFile(downloadUrl, binaryPath);
  } catch (error) {
    throw new Error(`Failed to download binary from ${downloadUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Verify the downloaded binary exists and is executable
  if (!binaryExists(binaryPath)) {
    throw new Error(`Downloaded binary is not valid: ${binaryPath}`);
  }

  // Verify checksum if provided
  let checksumVerified: boolean | undefined;
  if (options.checksum) {
    try {
      await verifyChecksum(binaryPath, options.checksum);
      checksumVerified = true;
    } catch (error) {
      // Clean up invalid binary
      try {
        fs.unlinkSync(binaryPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  return {
    binaryPath,
    version: options.version,
    platform,
    downloaded: true,
    checksumVerified
  };
}

/**
 * Get the path to a binary for a specific version (without downloading)
 */
export function getBinaryPath(
  storageDir: string,
  version: string,
  binaryName: string = 'taskmaster',
  platform?: PlatformInfo
): string {
  const detectedPlatform = platform || detectPlatform();
  const versionedBinaryName = `${binaryName}-${version}-${detectedPlatform.os}-${detectedPlatform.arch}${detectedPlatform.extension}`;
  return path.join(storageDir, versionedBinaryName);
}

/**
 * Check if a specific version of a binary is available locally
 */
export function isBinaryAvailable(
  storageDir: string,
  version: string,
  binaryName: string = 'taskmaster',
  platform?: PlatformInfo
): boolean {
  const binaryPath = getBinaryPath(storageDir, version, binaryName, platform);
  return binaryExists(binaryPath);
}

/**
 * List all available binary versions in storage directory
 */
export function listAvailableVersions(
  storageDir: string,
  binaryName: string = 'taskmaster'
): string[] {
  if (!fs.existsSync(storageDir)) {
    return [];
  }

  const files = fs.readdirSync(storageDir);
  const versions = new Set<string>();

  const pattern = new RegExp(`^${binaryName}-(\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9.-]+)?)-`);

  for (const file of files) {
    const match = file.match(pattern);
    if (match) {
      versions.add(match[1]);
    }
  }

  return Array.from(versions).sort();
}

/**
 * Clean up old binary versions, keeping only the specified number of recent versions
 */
export function cleanupOldVersions(
  storageDir: string,
  keepCount: number = 3,
  binaryName: string = 'taskmaster'
): void {
  const versions = listAvailableVersions(storageDir, binaryName);
  
  if (versions.length <= keepCount) {
    return;
  }

  // Remove older versions (keep the most recent ones)
  const versionsToRemove = versions.slice(0, versions.length - keepCount);
  
  for (const version of versionsToRemove) {
    const platform = detectPlatform();
    const binaryPath = getBinaryPath(storageDir, version, binaryName, platform);
    
    try {
      if (fs.existsSync(binaryPath)) {
        fs.unlinkSync(binaryPath);
      }
    } catch (error) {
      // Ignore cleanup errors, but could log them if needed
    }
  }
}