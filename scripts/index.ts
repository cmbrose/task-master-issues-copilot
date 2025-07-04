/**
 * Binary Download and Pinning Module
 * 
 * This module provides functionality to:
 * - Download CLI binaries from remote sources
 * - Pin specific versions of binaries
 * - Support multiple operating systems and architectures
 * - Manage binary storage locations
 * 
 * Usage:
 * ```typescript
 * import { downloadBinary, BinaryDownloadOptions } from './scripts/binary-downloader';
 * 
 * const options: BinaryDownloadOptions = {
 *   baseUrl: 'https://github.com/owner/taskmaster/releases/download',
 *   version: '1.0.0',
 *   storageDir: './bin'
 * };
 * 
 * const binaryInfo = await downloadBinary(options);
 * console.log(`Binary downloaded to: ${binaryInfo.binaryPath}`);
 * ```
 */

// Export main functionality
export {
  downloadBinary,
  getBinaryPath,
  isBinaryAvailable,
  listAvailableVersions,
  cleanupOldVersions,
  type BinaryDownloadOptions,
  type BinaryInfo
} from './binary-downloader';

// Export platform utilities
export {
  detectPlatform,
  getBinaryName,
  getBinaryDownloadUrl,
  type PlatformInfo
} from './platform-utils';