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
  getWrapperPath,
  isWrapperAvailable,
  createBinaryWrapper,
  type BinaryDownloadOptions,
  type BinaryInfo,
  type ChecksumOptions
} from './binary-downloader';

// Export platform utilities
export {
  detectPlatform,
  getBinaryName,
  getBinaryDownloadUrl,
  type PlatformInfo
} from './platform-utils';

// Export wrapper script utilities  
export {
  createWrapperScript,
  removeWrapperScript,
  wrapperExists,
  addToPath,
  setupWrapperEnvironment,
  type WrapperScriptOptions,
  type WrapperScriptInfo
} from './wrapper-scripts';

// Export configuration management utilities
export {
  loadConfig,
  loadFromEnvironment,
  loadFromFile,
  saveConfig,
  validateConfig,
  findConfigFiles,
  getConfigValue,
  createPreset,
  DEFAULT_CONFIG,
  VALIDATION_RULES,
  type TaskmasterConfig,
  type ConfigFile,
  type ConfigLoadOptions,
  type ValidationResult,
  type ValidationRule
} from './config-management';

// Export output format validation utilities
export {
  detectOutputFormat,
  parseJsonOutput,
  parseXmlOutput,
  parseTextOutput,
  sanitizeOutput,
  validateOutput,
  convertFormat,
  type OutputFormat,
  type OutputValidationResult,
  type OutputValidationOptions,
  type FormatConversionOptions,
  type ConversionResult
} from './output-validation';

// Export output processing integration utilities
export {
  processCliOutput,
  validateCliOutput,
  getOutputConfigFromEnvironment,
  createOutputProcessor,
  type OutputProcessingOptions,
  type OutputProcessingResult
} from './output-processing';