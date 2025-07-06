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
import { DefaultArtifactClient } from '@actions/artifact';
import type { ProcessingCheckpoint } from './github-api';

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
  async uploadTaskGraph(taskGraph: any, metadata: Partial<TaskGraphArtifact['metadata']> = {}): Promise<string> {
    const artifactId = this.generateArtifactId();
    
    const artifact: TaskGraphArtifact = {
      id: artifactId,
      taskGraph,
      metadata: {
        createdAt: new Date(),
        totalTasks: this.calculateTotalTasks(taskGraph),
        maxDepth: this.calculateTaskHierarchyDepth(taskGraph.tasks || []),
        leafTasks: this.countLeafTasks(taskGraph.tasks || []),
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
      console.log(`   - Size: ${this.formatFileSize(uploadResult.size || 0)}`);

      return artifactId;
    } catch (error) {
      console.error(`❌ Failed to upload task graph artifact: ${error instanceof Error ? error.message : String(error)}`);
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
      console.warn(`⚠️ Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error(`❌ Failed to create replay data: ${error instanceof Error ? error.message : String(error)}`);
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
      console.warn(`⚠️ Failed to upload performance report: ${error instanceof Error ? error.message : String(error)}`);
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
      console.warn(`Warning: Failed to cleanup temp files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Factory function to create artifact manager
 */
export function createArtifactManager(): ArtifactManager {
  return new ArtifactManager();
}