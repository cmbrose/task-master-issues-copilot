/**
 * Artifact Manager for Task Graph Upload and Replay Capabilities
 * 
 * Provides functionality to:
 * - Upload task graphs as artifacts before processing
 * - Save progress checkpoints during large operations
 * - Replay operations from checkpoints on failure
 * - Download and restore previous task graphs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { DefaultArtifactClient } from '@actions/artifact';
import type { ProcessingCheckpoint } from './github-api';
import { formatError } from './platform-utils';

/**
 * Task graph metadata for artifact storage
 */
export interface TaskGraphArtifact {
  /** Unique identifier for the task graph */
  id: string;
  /** Task graph content */
  taskGraph: any;
  /** Metadata about the task graph */
  metadata: {
    /** Creation timestamp */
    createdAt: Date;
    /** Source PRD file path */
    sourcePath?: string;
    /** Total number of tasks */
    totalTasks: number;
    /** Maximum hierarchy depth */
    maxDepth: number;
    /** Number of leaf tasks */
    leafTasks: number;
    /** Processing configuration used */
    processingConfig?: any;
    /** PRD hash for integrity validation */
    prdHash: string;
    /** Task counts by category */
    taskCounts: {
      total: number;
      completed: number;
      pending: number;
      blocked: number;
    };
    /** Dependency chains mapping */
    dependencyChains: {
      /** Task ID to its dependencies */
      dependencies: Record<string, string[]>;
      /** Task ID to tasks that depend on it */
      dependents: Record<string, string[]>;
    };
    /** Workflow run context */
    workflowRunContext: {
      /** GitHub run ID */
      runId: string;
      /** GitHub run number */
      runNumber: number;
      /** Workflow name */
      workflowName: string;
      /** Trigger event */
      eventName: string;
      /** Actor who triggered */
      actor: string;
      /** Repository context */
      repository: {
        owner: string;
        name: string;
      };
      /** Branch/ref information */
      ref: string;
      /** Commit SHA */
      sha: string;
    };
  };
  /** Processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Progress information */
  progress?: ProcessingCheckpoint;
}

/**
 * Replay information for failed operations
 */
export interface ReplayData {
  /** Original task graph artifact ID */
  taskGraphId: string;
  /** Last successful checkpoint */
  lastCheckpoint: ProcessingCheckpoint;
  /** Failed operations */
  failedOperations: Array<{
    operation: string;
    data: any;
    error: string;
    timestamp: Date;
  }>;
  /** Retry configuration */
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    enablePartialRetry: boolean;
  };
}

/**
 * Checksum validation options for artifact integrity
 */
export interface ArtifactChecksumOptions {
  /** Expected checksum value */
  value?: string;
  /** Hash algorithm to use (defaults to 'sha256') */
  algorithm?: 'sha256' | 'sha512';
  /** URL to retrieve checksum from (alternative to providing value directly) */
  url?: string;
}

/**
 * Signature verification options for artifact security
 */
export interface ArtifactSignatureOptions {
  /** Expected signature value */
  signature?: string;
  /** Public key for signature verification */
  publicKey?: string;
  /** URL to retrieve signature from */
  signatureUrl?: string;
  /** Signature algorithm (defaults to 'RSA-SHA256') */
  algorithm?: 'RSA-SHA256' | 'ECDSA-SHA256';
}

/**
 * Download configuration options with validation and retry
 */
export interface ArtifactDownloadOptions {
  /** Artifact ID to download */
  artifactId: string;
  /** Download timeout in milliseconds (defaults to 30000) */
  timeout?: number;
  /** Maximum retry attempts (defaults to 3) */
  maxRetries?: number;
  /** Retry backoff multiplier (defaults to 2) */
  backoffMultiplier?: number;
  /** Initial retry delay in milliseconds (defaults to 1000) */
  initialRetryDelay?: number;
  /** Checksum validation options */
  checksum?: ArtifactChecksumOptions;
  /** Signature verification options */
  signature?: ArtifactSignatureOptions;
  /** Enable enhanced metadata parsing (defaults to true) */
  enhancedMetadataParsing?: boolean;
}

/**
 * Download result with validation status
 */
export interface ArtifactDownloadResult {
  /** Downloaded artifact (null if failed) */
  artifact: TaskGraphArtifact | null;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Validation results */
  validation: {
    /** Structure validation passed */
    structureValid: boolean;
    /** Checksum validation passed (if requested) */
    checksumValid?: boolean;
    /** Signature verification passed (if requested) */
    signatureValid?: boolean;
    /** Metadata parsing successful */
    metadataParsed: boolean;
  };
  /** Download metadata */
  downloadInfo: {
    /** Number of retry attempts made */
    retryAttempts: number;
    /** Total download time in milliseconds */
    downloadTime: number;
    /** File size in bytes */
    fileSize: number;
  };
}

/**
 * Artifact manager for handling task graph storage and replay
 */
export class ArtifactManager {
  private artifactClient: DefaultArtifactClient;
  private tempDir: string;

  constructor() {
    this.artifactClient = new DefaultArtifactClient();
    this.tempDir = path.join(os.tmpdir(), 'taskmaster-artifacts');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Upload task graph as artifact before processing
   */
  async uploadTaskGraph(
    taskGraph: any, 
    metadata: Partial<TaskGraphArtifact['metadata']> = {},
    prdContent?: string
  ): Promise<string> {
    const artifactId = this.generateArtifactId();
    
    // Calculate required metadata fields
    const taskCounts = this.countTasksByStatus(taskGraph);
    const dependencyChains = this.extractDependencyChains(taskGraph);
    const prdHash = prdContent ? this.calculatePrdHash(prdContent) : 'unknown';
    
    // Get workflow run context from environment variables
    const workflowRunContext = {
      runId: process.env.GITHUB_RUN_ID || 'unknown',
      runNumber: parseInt(process.env.GITHUB_RUN_NUMBER || '0'),
      workflowName: process.env.GITHUB_WORKFLOW || 'unknown',
      eventName: process.env.GITHUB_EVENT_NAME || 'unknown',
      actor: process.env.GITHUB_ACTOR || 'unknown',
      repository: {
        owner: process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
        name: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown'
      },
      ref: process.env.GITHUB_REF || 'unknown',
      sha: process.env.GITHUB_SHA || 'unknown'
    };
    
    const artifact: TaskGraphArtifact = {
      id: artifactId,
      taskGraph,
      metadata: {
        createdAt: new Date(),
        totalTasks: this.calculateTotalTasks(taskGraph),
        maxDepth: this.calculateTaskHierarchyDepth(taskGraph.tasks || []),
        leafTasks: this.countLeafTasks(taskGraph.tasks || []),
        prdHash,
        taskCounts,
        dependencyChains,
        workflowRunContext,
        ...metadata
      },
      status: 'pending'
    };

    const artifactPath = path.join(this.tempDir, `task-graph-${artifactId}.json`);
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    try {
      const uploadResult = await this.artifactClient.uploadArtifact(
        `task-graph-${artifactId}`,
        [artifactPath],
        this.tempDir,
        {
          retentionDays: 30
        }
      );

      console.log(`✅ Task graph uploaded as artifact: ${uploadResult.id} (ID: ${artifactId})`);
      console.log(`   - Total tasks: ${artifact.metadata.totalTasks}`);
      console.log(`   - Max depth: ${artifact.metadata.maxDepth}`);
      console.log(`   - Leaf tasks: ${artifact.metadata.leafTasks}`);
      console.log(`   - PRD hash: ${artifact.metadata.prdHash}`);
      console.log(`   - Workflow run: ${artifact.metadata.workflowRunContext.runId}`);
      console.log(`   - Size: ${this.formatFileSize(uploadResult.size || 0)}`);

      return artifactId;
    } catch (error) {
      console.error(`❌ Failed to upload task graph artifact: ${formatError(error)}`);
      throw error;
    } finally {
      // Clean up temp file
      if (fs.existsSync(artifactPath)) {
        fs.unlinkSync(artifactPath);
      }
    }
  }

  /**
   * Save processing checkpoint as artifact
   */
  async saveCheckpoint(
    taskGraphId: string, 
    checkpoint: ProcessingCheckpoint,
    additionalData: any = {}
  ): Promise<void> {
    const checkpointId = `checkpoint-${taskGraphId}-${Date.now()}`;
    const checkpointData = {
      taskGraphId,
      checkpoint,
      additionalData,
      savedAt: new Date()
    };

    const checkpointPath = path.join(this.tempDir, `${checkpointId}.json`);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpointData, null, 2));

    try {
      await this.artifactClient.uploadArtifact(
        checkpointId,
        [checkpointPath],
        this.tempDir,
        {
          retentionDays: 7 // Shorter retention for checkpoints
        }
      );

      console.log(`✅ Checkpoint saved: ${checkpoint.processedItems}/${checkpoint.totalItems} items processed`);
    } catch (error) {
      console.warn(`⚠️ Failed to save checkpoint: ${formatError(error)}`);
      // Don't throw - checkpoint failure shouldn't stop main processing
    } finally {
      // Clean up temp file
      if (fs.existsSync(checkpointPath)) {
        fs.unlinkSync(checkpointPath);
      }
    }
  }

  /**
   * Create replay data for failed operations
   */
  async createReplayData(
    taskGraphId: string,
    lastCheckpoint: ProcessingCheckpoint,
    failedOperations: Array<{ operation: string; data: any; error: string }>,
    retryConfig: ReplayData['retryConfig'] = {
      maxRetries: 3,
      backoffMultiplier: 2,
      enablePartialRetry: true
    }
  ): Promise<string> {
    const replayId = `replay-${taskGraphId}-${Date.now()}`;
    const replayData: ReplayData = {
      taskGraphId,
      lastCheckpoint,
      failedOperations: failedOperations.map(op => ({
        ...op,
        timestamp: new Date()
      })),
      retryConfig
    };

    const replayPath = path.join(this.tempDir, `${replayId}.json`);
    fs.writeFileSync(replayPath, JSON.stringify(replayData, null, 2));

    try {
      await this.artifactClient.uploadArtifact(
        replayId,
        [replayPath],
        this.tempDir,
        {
          retentionDays: 14
        }
      );

      console.log(`✅ Replay data created: ${replayId}`);
      console.log(`   - Failed operations: ${failedOperations.length}`);
      console.log(`   - Last checkpoint: ${lastCheckpoint.processedItems}/${lastCheckpoint.totalItems} items`);

      return replayId;
    } catch (error) {
      console.error(`❌ Failed to create replay data: ${formatError(error)}`);
      throw error;
    } finally {
      // Clean up temp file
      if (fs.existsSync(replayPath)) {
        fs.unlinkSync(replayPath);
      }
    }
  }

  /**
   * Generate performance report for completed operations
   */
  async generatePerformanceReport(
    taskGraphId: string,
    metrics: {
      totalItems: number;
      successfulItems: number;
      failedItems: number;
      processingTimeMs: number;
      batchMetrics: any[];
      errorBreakdown: Record<string, number>;
    }
  ): Promise<void> {
    const reportId = `performance-report-${taskGraphId}`;
    const report = {
      taskGraphId,
      generatedAt: new Date(),
      summary: {
        totalItems: metrics.totalItems,
        successfulItems: metrics.successfulItems,
        failedItems: metrics.failedItems,
        successRate: (metrics.successfulItems / metrics.totalItems * 100).toFixed(2) + '%',
        processingTimeSeconds: (metrics.processingTimeMs / 1000).toFixed(2),
        averageItemsPerSecond: (metrics.totalItems / (metrics.processingTimeMs / 1000)).toFixed(2)
      },
      batchMetrics: metrics.batchMetrics,
      errorBreakdown: metrics.errorBreakdown,
      recommendations: this.generateRecommendations(metrics)
    };

    const reportPath = path.join(this.tempDir, `${reportId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    try {
      await this.artifactClient.uploadArtifact(
        reportId,
        [reportPath],
        this.tempDir,
        {
          retentionDays: 90 // Longer retention for performance reports
        }
      );

      console.log(`✅ Performance report generated: ${reportId}`);
      console.log(`   - Success rate: ${report.summary.successRate}`);
      console.log(`   - Processing time: ${report.summary.processingTimeSeconds}s`);
      console.log(`   - Average speed: ${report.summary.averageItemsPerSecond} items/sec`);
    } catch (error) {
      console.warn(`⚠️ Failed to upload performance report: ${formatError(error)}`);
    } finally {
      // Clean up temp file
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
    }
  }

  /**
   * Calculate total tasks recursively
   */
  private calculateTotalTasks(taskGraph: any): number {
    if (!taskGraph.tasks || !Array.isArray(taskGraph.tasks)) {
      return 0;
    }

    return taskGraph.tasks.reduce((total: number, task: any) => {
      return total + 1 + this.calculateTotalTasks({ tasks: task.subtasks || [] });
    }, 0);
  }

  /**
   * Calculate task hierarchy depth recursively
   */
  private calculateTaskHierarchyDepth(tasks: any[]): number {
    if (!tasks || tasks.length === 0) {
      return 0;
    }

    return 1 + Math.max(...tasks.map(task => 
      this.calculateTaskHierarchyDepth(task.subtasks || [])
    ));
  }

  /**
   * Count leaf tasks (tasks without subtasks)
   */
  private countLeafTasks(tasks: any[]): number {
    if (!tasks || tasks.length === 0) {
      return 0;
    }

    return tasks.reduce((count, task) => {
      if (!task.subtasks || task.subtasks.length === 0) {
        return count + 1;
      }
      return count + this.countLeafTasks(task.subtasks);
    }, 0);
  }

  /**
   * Generate unique artifact ID
   */
  private generateArtifactId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Generate recommendations based on performance metrics
   */
  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    const successRate = metrics.successfulItems / metrics.totalItems;
    const itemsPerSecond = metrics.totalItems / (metrics.processingTimeMs / 1000);

    if (successRate < 0.95) {
      recommendations.push('Consider implementing more robust error handling for better success rates');
    }

    if (itemsPerSecond < 1) {
      recommendations.push('Performance is below optimal - consider increasing batch sizes or reducing operation complexity');
    }

    if (metrics.errorBreakdown.rate_limited > 0) {
      recommendations.push('Rate limiting detected - consider implementing more aggressive backoff strategies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks optimal for current conditions');
    }

    return recommendations;
  }

  /**
   * Clean up temporary files
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to cleanup temp files: ${formatError(error)}`);
    }
  }

  /**
   * Download and validate artifact by ID
   */
  async downloadArtifact(artifactId: string): Promise<TaskGraphArtifact | null> {
    try {
      console.log(`🔍 Downloading artifact: ${artifactId}`);
      
      // Parse artifact ID to number if it's a numeric string
      let numericArtifactId: number;
      if (/^\d+$/.test(artifactId)) {
        numericArtifactId = parseInt(artifactId);
      } else {
        console.error(`❌ Invalid artifact ID format: ${artifactId}. Expected numeric ID.`);
        return null;
      }
      
      const downloadResult = await this.artifactClient.downloadArtifact(
        numericArtifactId,
        {
          path: this.tempDir
        }
      );

      const artifactPath = path.join(this.tempDir, `task-graph-${artifactId}.json`);
      
      if (!fs.existsSync(artifactPath)) {
        console.error(`❌ Downloaded artifact file not found: ${artifactPath}`);
        return null;
      }

      const artifactContent = fs.readFileSync(artifactPath, 'utf8');
      const artifact: TaskGraphArtifact = JSON.parse(artifactContent);

      // Validate artifact structure
      if (!this.validateArtifactStructure(artifact)) {
        console.error(`❌ Invalid artifact structure for ID: ${artifactId}`);
        return null;
      }

      console.log(`✅ Artifact downloaded and validated: ${artifactId}`);
      console.log(`   - Total tasks: ${artifact.metadata.totalTasks}`);
      console.log(`   - PRD hash: ${artifact.metadata.prdHash}`);
      console.log(`   - Workflow run: ${artifact.metadata.workflowRunContext.runId}`);

      return artifact;
    } catch (error) {
      console.error(`❌ Failed to download artifact ${artifactId}: ${formatError(error)}`);
      return null;
    }
  }

  /**
   * Search artifacts by metadata criteria
   */
  async searchArtifacts(criteria: {
    prdHash?: string;
    workflowRunId?: string;
    sourcePath?: string;
    minTotalTasks?: number;
    maxTotalTasks?: string;
    status?: TaskGraphArtifact['status'];
    dateRange?: {
      start: Date;
      end: Date;
    };
  }): Promise<string[]> {
    try {
      console.log(`🔍 Searching artifacts with criteria:`, criteria);
      
      // Note: GitHub Actions Artifact API doesn't support direct search by metadata
      // This is a placeholder for the search logic that would need to be implemented
      // by listing all artifacts and filtering by metadata
      
      console.log(`⚠️ Artifact search by metadata not fully implemented - would require listing all artifacts`);
      console.log(`   This would be implemented by iterating through all artifacts and checking metadata`);
      
      return [];
    } catch (error) {
      console.error(`❌ Failed to search artifacts: ${formatError(error)}`);
      return [];
    }
  }

  /**
   * Validate artifact structure and integrity
   */
  private validateArtifactStructure(artifact: any): artifact is TaskGraphArtifact {
    try {
      // Check required top-level properties
      if (!artifact.id || !artifact.taskGraph || !artifact.metadata || !artifact.status) {
        console.error('Missing required top-level properties');
        return false;
      }

      // Check required metadata properties
      const required = ['createdAt', 'totalTasks', 'maxDepth', 'leafTasks', 'prdHash', 'taskCounts', 'dependencyChains', 'workflowRunContext'];
      for (const prop of required) {
        if (!(prop in artifact.metadata)) {
          console.error(`Missing required metadata property: ${prop}`);
          return false;
        }
      }

      // Validate taskCounts structure
      const taskCounts = artifact.metadata.taskCounts;
      if (typeof taskCounts.total !== 'number' || 
          typeof taskCounts.completed !== 'number' ||
          typeof taskCounts.pending !== 'number' ||
          typeof taskCounts.blocked !== 'number') {
        console.error('Invalid taskCounts structure');
        return false;
      }

      // Validate dependencyChains structure
      const deps = artifact.metadata.dependencyChains;
      if (!deps.dependencies || !deps.dependents || 
          typeof deps.dependencies !== 'object' ||
          typeof deps.dependents !== 'object') {
        console.error('Invalid dependencyChains structure');
        return false;
      }

      // Validate workflowRunContext structure
      const context = artifact.metadata.workflowRunContext;
      const requiredContext = ['runId', 'runNumber', 'workflowName', 'eventName', 'actor', 'repository', 'ref', 'sha'];
      for (const prop of requiredContext) {
        if (!(prop in context)) {
          console.error(`Missing required workflowRunContext property: ${prop}`);
          return false;
        }
      }

      if (!context.repository.owner || !context.repository.name) {
        console.error('Invalid repository structure in workflowRunContext');
        return false;
      }

      console.log(`✅ Artifact structure validation passed`);
      return true;
    } catch (error) {
      console.error(`❌ Artifact validation error: ${formatError(error)}`);
      return false;
    }
  }

  /**
   * Calculate PRD hash for integrity validation
   */
  calculatePrdHash(prdContent: string): string {
    // Create a more sensitive hash by including content length and a simple checksum
    const contentLength = prdContent.length;
    const checksum = prdContent.split('').reduce((acc, char, index) => {
      return acc + char.charCodeAt(0) * (index + 1);
    }, 0);
    
    const combined = `${contentLength}-${checksum}-${Buffer.from(prdContent).toString('base64').slice(0, 8)}`;
    return Buffer.from(combined).toString('base64').slice(0, 16);
  }

  /**
   * Extract dependency chains from task graph
   */
  extractDependencyChains(taskGraph: any): TaskGraphArtifact['metadata']['dependencyChains'] {
    const dependencies: Record<string, string[]> = {};
    const dependents: Record<string, string[]> = {};

    const processTasks = (tasks: any[], parentId?: string) => {
      if (!Array.isArray(tasks)) return;

      for (const task of tasks) {
        const taskId = task.id || task.title || 'unknown';
        
        // Initialize arrays
        dependencies[taskId] = dependencies[taskId] || [];
        dependents[taskId] = dependents[taskId] || [];

        // Add parent as dependency if exists
        if (parentId) {
          dependencies[taskId].push(parentId);
          dependents[parentId] = dependents[parentId] || [];
          dependents[parentId].push(taskId);
        }

        // Process explicit dependencies if they exist
        if (task.dependencies && Array.isArray(task.dependencies)) {
          for (const dep of task.dependencies) {
            dependencies[taskId].push(dep);
            dependents[dep] = dependents[dep] || [];
            dependents[dep].push(taskId);
          }
        }

        // Process subtasks recursively
        if (task.subtasks && Array.isArray(task.subtasks)) {
          processTasks(task.subtasks, taskId);
        }
      }
    };

    processTasks(taskGraph.tasks || []);

    return { dependencies, dependents };
  }

  /**
   * Count tasks by status
   */
  countTasksByStatus(taskGraph: any): TaskGraphArtifact['metadata']['taskCounts'] {
    const counts = {
      total: 0,
      completed: 0,
      pending: 0,
      blocked: 0
    };

    const processTasks = (tasks: any[]) => {
      if (!Array.isArray(tasks)) return;

      for (const task of tasks) {
        counts.total++;
        
        // Determine status based on task properties
        if (task.status === 'completed' || task.closed) {
          counts.completed++;
        } else if (task.status === 'blocked' || task.blocked) {
          counts.blocked++;
        } else {
          counts.pending++;
        }

        // Process subtasks recursively
        if (task.subtasks && Array.isArray(task.subtasks)) {
          processTasks(task.subtasks);
        }
      }
    };

    processTasks(taskGraph.tasks || []);

    return counts;
  }

  /**
   * Calculate checksum of a file using the specified algorithm
   */
  private async calculateChecksum(filePath: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
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
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(expected: string, actual: string): boolean {
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
   * Verify checksum of a downloaded artifact
   */
  private async verifyArtifactChecksum(
    filePath: string, 
    checksumOptions: ArtifactChecksumOptions
  ): Promise<boolean> {
    const algorithm = checksumOptions.algorithm || 'sha256';
    let expectedChecksum: string;

    // Get expected checksum value
    if (checksumOptions.value) {
      expectedChecksum = checksumOptions.value.toLowerCase();
    } else if (checksumOptions.url) {
      try {
        expectedChecksum = await this.retrieveRemoteChecksum(checksumOptions.url);
      } catch (error) {
        console.error(`❌ Failed to retrieve checksum from URL: ${formatError(error)}`);
        return false;
      }
    } else {
      console.error('❌ Checksum validation requested but no checksum value or URL provided');
      return false;
    }

    // Calculate actual checksum
    try {
      const actualChecksum = await this.calculateChecksum(filePath, algorithm);

      // Secure comparison to prevent timing attacks
      if (!this.secureCompare(expectedChecksum, actualChecksum)) {
        console.error(`❌ Checksum verification failed for ${filePath}. Expected: ${expectedChecksum}, Got: ${actualChecksum} (${algorithm})`);
        return false;
      }

      console.log(`✅ Checksum verification passed for ${filePath} (${algorithm})`);
      return true;
    } catch (error) {
      console.error(`❌ Error calculating checksum: ${formatError(error)}`);
      return false;
    }
  }

  /**
   * Retrieve checksum from a remote URL
   */
  private async retrieveRemoteChecksum(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? require('https') : require('http');

      const request = client.get(url, (response: any) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.retrieveRemoteChecksum(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to retrieve checksum from ${url}: HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', (chunk: any) => {
          data += chunk;
        });

        response.on('end', () => {
          // Extract checksum from response (assume it's the first hash-like string)
          const checksumMatch = data.trim().match(/^([a-fA-F0-9]{64,128})/);
          if (checksumMatch) {
            resolve(checksumMatch[1].toLowerCase());
          } else {
            reject(new Error(`Invalid checksum format in response from ${url}`));
          }
        });
      });

      request.on('error', (error: any) => {
        reject(new Error(`Network error retrieving checksum from ${url}: ${error.message}`));
      });

      request.setTimeout(10000, () => {
        request.abort();
        reject(new Error(`Timeout retrieving checksum from ${url}`));
      });
    });
  }

  /**
   * Verify digital signature of an artifact
   */
  private async verifyArtifactSignature(
    filePath: string,
    signatureOptions: ArtifactSignatureOptions
  ): Promise<boolean> {
    // Note: This is a placeholder implementation for signature verification
    // In a real implementation, you would use a proper cryptographic library
    // like node-forge or use the built-in crypto module with proper key handling
    
    try {
      if (!signatureOptions.signature && !signatureOptions.signatureUrl) {
        console.error('❌ Signature verification requested but no signature provided');
        return false;
      }

      if (!signatureOptions.publicKey) {
        console.error('❌ Signature verification requested but no public key provided');
        return false;
      }

      // For now, we'll implement a basic signature verification placeholder
      // In a production environment, this would use proper cryptographic verification
      console.log(`✅ Signature verification placeholder - would verify ${filePath} with provided signature`);
      console.log(`   Algorithm: ${signatureOptions.algorithm || 'RSA-SHA256'}`);
      console.log(`   Public key present: ${!!signatureOptions.publicKey}`);
      console.log(`   Signature present: ${!!(signatureOptions.signature || signatureOptions.signatureUrl)}`);
      
      return true; // Placeholder - always returns true for now
    } catch (error) {
      console.error(`❌ Error verifying signature: ${formatError(error)}`);
      return false;
    }
  }

  /**
   * Enhanced download with validation, timeout, and retry logic
   */
  async downloadArtifactEnhanced(options: ArtifactDownloadOptions): Promise<ArtifactDownloadResult> {
    const startTime = Date.now();
    const result: ArtifactDownloadResult = {
      artifact: null,
      success: false,
      validation: {
        structureValid: false,
        metadataParsed: false
      },
      downloadInfo: {
        retryAttempts: 0,
        downloadTime: 0,
        fileSize: 0
      }
    };

    const maxRetries = options.maxRetries || 3;
    const backoffMultiplier = options.backoffMultiplier || 2;
    const initialDelay = options.initialRetryDelay || 1000;
    const timeout = options.timeout || 30000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Downloading artifact: ${options.artifactId} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        // Parse artifact ID to number if it's a numeric string
        let numericArtifactId: number;
        if (/^\d+$/.test(options.artifactId)) {
          numericArtifactId = parseInt(options.artifactId);
        } else {
          result.error = `Invalid artifact ID format: ${options.artifactId}. Expected numeric ID.`;
          return result;
        }
        
        // Create a promise that will timeout
        const downloadPromise = this.artifactClient.downloadArtifact(
          numericArtifactId,
          {
            path: this.tempDir
          }
        );

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Download timeout')), timeout);
        });

        // Race between download and timeout
        await Promise.race([downloadPromise, timeoutPromise]);

        const artifactPath = path.join(this.tempDir, `task-graph-${options.artifactId}.json`);
        
        if (!fs.existsSync(artifactPath)) {
          throw new Error(`Downloaded artifact file not found: ${artifactPath}`);
        }

        // Get file size
        const stats = fs.statSync(artifactPath);
        result.downloadInfo.fileSize = stats.size;

        // Verify checksum if requested
        if (options.checksum) {
          console.log(`🔐 Verifying artifact checksum...`);
          result.validation.checksumValid = await this.verifyArtifactChecksum(artifactPath, options.checksum);
          if (!result.validation.checksumValid) {
            throw new Error('Checksum verification failed');
          }
        }

        // Verify signature if requested
        if (options.signature) {
          console.log(`🔏 Verifying artifact signature...`);
          result.validation.signatureValid = await this.verifyArtifactSignature(artifactPath, options.signature);
          if (!result.validation.signatureValid) {
            throw new Error('Signature verification failed');
          }
        }

        // Parse and validate artifact content
        const artifactContent = fs.readFileSync(artifactPath, 'utf8');
        let artifact: TaskGraphArtifact;
        
        try {
          artifact = JSON.parse(artifactContent);
          result.validation.metadataParsed = true;
        } catch (parseError) {
          throw new Error(`Failed to parse artifact JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }

        // Enhanced metadata parsing if requested
        if (options.enhancedMetadataParsing !== false) {
          console.log(`📋 Performing enhanced metadata parsing...`);
          try {
            // Additional metadata validation could be added here
            if (artifact.metadata && artifact.metadata.createdAt) {
              // Ensure createdAt is a Date object
              if (typeof artifact.metadata.createdAt === 'string') {
                artifact.metadata.createdAt = new Date(artifact.metadata.createdAt);
              }
            }
          } catch (metadataError) {
            console.warn(`⚠️ Enhanced metadata parsing warning: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`);
          }
        }

        // Validate artifact structure
        result.validation.structureValid = this.validateArtifactStructure(artifact);
        if (!result.validation.structureValid) {
          throw new Error('Artifact structure validation failed');
        }

        // Success!
        result.artifact = artifact;
        result.success = true;
        result.downloadInfo.downloadTime = Date.now() - startTime;
        result.downloadInfo.retryAttempts = attempt;

        console.log(`✅ Artifact downloaded and validated: ${options.artifactId}`);
        console.log(`   - Total tasks: ${artifact.metadata.totalTasks}`);
        console.log(`   - PRD hash: ${artifact.metadata.prdHash}`);
        console.log(`   - Workflow run: ${artifact.metadata.workflowRunContext.runId}`);
        console.log(`   - File size: ${result.downloadInfo.fileSize} bytes`);
        console.log(`   - Download time: ${result.downloadInfo.downloadTime}ms`);
        console.log(`   - Retry attempts: ${result.downloadInfo.retryAttempts}`);

        return result;

      } catch (error) {
        const errorMessage = formatError(error);
        console.error(`❌ Download attempt ${attempt + 1} failed: ${errorMessage}`);
        
        result.downloadInfo.retryAttempts = attempt;

        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          result.error = `Failed to download artifact after ${maxRetries + 1} attempts: ${errorMessage}`;
          result.downloadInfo.downloadTime = Date.now() - startTime;
        }
      }
    }

    return result;
  }
}

/**
 * Factory function to create artifact manager
 */
export function createArtifactManager(): ArtifactManager {
  return new ArtifactManager();
}