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
  validateTaskGraphSchema,
  parseTaskGraphJson,
  extractTasksForGitHub,
  calculateTaskComplexity,
  type OutputFormat,
  type OutputValidationResult,
  type OutputValidationOptions,
  type FormatConversionOptions,
  type ConversionResult,
  type Task,
  type TaskGraph,
  type GitHubTaskData
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

// Export enhanced GitHub API utilities
export {
  EnhancedGitHubApi,
  createGitHubApiClient,
  GitHubErrorCategory,
  CircuitBreakerState,
  OperationPriority,
  type GitHubApiConfig,
  type BatchProcessingConfig,
  type GitHubApiError,
  type RateLimitInfo,
  type ApiIssue,
  type BatchOperationResult,
  type BatchMetrics,
  type ProcessingCheckpoint
} from './github-api';

// Export artifact management utilities
export {
  ArtifactManager,
  createArtifactManager,
  type TaskGraphArtifact,
  type ReplayData,
  type ArtifactChecksumOptions,
  type ArtifactSignatureOptions,
  type ArtifactDownloadOptions,
  type ArtifactDownloadResult
} from './artifact-manager';

// Export issue parsing utilities
export {
  parseYamlFrontMatter,
  parseMetadata,
  parseDependencies,
  parseRequiredBy,
  parseContentSections,
  parseIssueBody,
  hasYamlFrontMatter,
  DependencyGraphAnalyzer,
  extractTaskId,
  extractParentId,
  type ParsedYamlFrontMatter,
  type ParsedMetadata,
  type ParsedDependency,
  type ParsedIssueData,
  type DependencyNode,
  type CircularDependency,
  type ResolutionOrder,
  type CriticalPath
} from './issue-parser';

// Export comment parsing utilities
export {
  containsCommand,
  parseCommand,
  validateBreakdownArgs,
  parseBreakdownCommand,
  type ParsedCommand,
  type CommandArguments,
  type CommentParseOptions
} from './comment-parser';

// Export sub-issue creation utilities
export {
  generateSubIssueLabels,
  buildSubIssueTitle,
  buildSubIssueBody,
  createSubIssueFromTask,
  updateIssueWithDependencies,
  updateBodyWithRequiredBy,
  addSubIssueRelationship,
  updateDependencyLabels,
  type Task as SubIssueTask,
  type Issue,
  type ParentIssue
} from './sub-issue-creation';

// Export parent issue state management utilities
export {
  ParentIssueStateManager,
  BreakdownStatus,
  type ParentIssueState,
  type BreakdownMetadata
} from './parent-issue-state-manager';

// Export markdown formatting utilities
export {
  formatTaskGraphMarkdown,
  formatCompactTaskGraphSummary,
  type Task as MarkdownTask,
  type TaskGraph as MarkdownTaskGraph,
  type MarkdownFormatterOptions
} from './markdown-formatter';

// Export PR comment management utilities
export {
  PrCommentManager,
  createPrCommentManager,
  postTaskGraphPreview,
  type PrCommentConfig
} from './pr-comment-manager';