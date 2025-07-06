/**
 * Taskmaster Watcher Action
 * 
 * This action watches for issue changes and updates dependencies/blocked status.
 * Triggered by issue closed events and cron schedules.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { 
  loadConfig, 
  TaskmasterConfig,
  EnhancedGitHubApi,
  createGitHubApiClient,
  parseIssueBody,
  ApiIssue,
  type ParsedDependency,
  DependencyGraphAnalyzer,
  type ParsedIssueData,
  ArtifactManager,
  createArtifactManager,
  type ProcessingCheckpoint,
  type BatchMetrics,
  OperationPriority
} from '../../../scripts/index';

interface BlockedStatusResult {
  issuesUpdated: number;
  dependenciesResolved: number;
  errors: string[];
  performanceMetrics?: {
    processingTimeMs: number;
    issuesScanned: number;
    dependencyGraphSize: number;
    cyclesDetected: number;
    batchMetrics?: BatchMetrics;
    artifactId?: string;
  };
}

/**
 * Enhanced function to find issues that can be unblocked by closed issues
 * Uses advanced dependency graph analysis for better performance
 */
async function findUnblockableIssuesBatch(
  githubApi: EnhancedGitHubApi,
  closedIssueNumbers: number[]
): Promise<{ unblockableIssues: ApiIssue[]; metrics: any }> {
  const startTime = Date.now();
  const unblockableIssues: ApiIssue[] = [];
  
  try {
    // Get all open issues with taskmaster label
    const openIssues = await githubApi.listIssues({
      state: 'open',
      labels: 'taskmaster'
    });

    // Parse all issues to create dependency graph
    const parsedIssues: ParsedIssueData[] = [];
    for (const issue of openIssues) {
      if (!issue.body) continue;
      
      try {
        const parsed = parseIssueBody(issue.body);
        // Add issue number if not in YAML front-matter
        if (!parsed.yamlFrontMatter.id) {
          parsed.yamlFrontMatter.id = issue.number;
        }
        parsedIssues.push(parsed);
      } catch (parseError) {
        core.warning(`Failed to parse issue #${issue.number}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
    
    // Build dependency graph
    const graph = DependencyGraphAnalyzer.buildDependencyGraph(parsedIssues);
    
    // Detect cycles
    const cycles = DependencyGraphAnalyzer.detectCircularDependencies(graph);
    if (cycles.length > 0) {
      core.warning(`Detected ${cycles.length} circular dependencies: ${cycles.map(c => c.description).join(', ')}`);
    }
    
    // Find unblockable issues using enhanced algorithm
    const unblockableIds = DependencyGraphAnalyzer.findUnblockableIssues(graph, closedIssueNumbers);
    
    // Map back to API issues
    for (const issueId of unblockableIds) {
      const issue = openIssues.find(i => i.number === issueId);
      if (issue) {
        unblockableIssues.push(issue);
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      unblockableIssues,
      metrics: {
        processingTimeMs: processingTime,
        issuesScanned: openIssues.length,
        dependencyGraphSize: graph.size,
        cyclesDetected: cycles.length,
        unblockableFound: unblockableIssues.length
      }
    };
  } catch (error) {
    core.error(`Failed to fetch open issues: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Update issue labels to reflect dependency status
 */
function updateDependencyLabels(dependencies: ParsedDependency[]): string[] {
  const additionalLabels: string[] = [];
  
  if (dependencies.length === 0) {
    return additionalLabels;
  }
  
  const openDependencies = dependencies.filter(dep => !dep.completed);
  
  if (openDependencies.length > 0) {
    additionalLabels.push('blocked');
    additionalLabels.push(`blocked-by:${openDependencies.length}`);
  } else {
    // All dependencies are closed, task is ready
    additionalLabels.push('ready');
  }
  
  return additionalLabels;
}

/**
 * Update an issue's labels and body to reflect new dependency status
 */
async function updateIssueStatus(
  githubApi: EnhancedGitHubApi,
  issue: ApiIssue,
  newDependencyLabels: string[]
): Promise<void> {
  if (!issue.body) return;
  
  // Get current labels, removing old dependency-related labels
  const currentLabels = issue.labels?.map((label: any) => 
    typeof label === 'string' ? label : label.name
  ).filter((label: any): label is string => Boolean(label)) || [];
  
  const filteredLabels = currentLabels.filter((label: string) => 
    !label.startsWith('blocked') && label !== 'ready'
  );
  
  const updatedLabels = [...filteredLabels, ...newDependencyLabels];
  
  try {
    await githubApi.updateIssue(issue.number, {
      labels: updatedLabels
    });
    
    const statusChange = newDependencyLabels.includes('ready') ? 'unblocked (ready)' : 
                        newDependencyLabels.includes('blocked') ? 'blocked' : 'unknown';
    core.info(`Updated issue #${issue.number} status to: ${statusChange}`);
  } catch (error) {
    core.error(`Failed to update issue #${issue.number}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Process blocked status management for webhook mode (single issue)
 * Enhanced with batch processing and performance monitoring
 */
async function processWebhookMode(githubApi: EnhancedGitHubApi): Promise<BlockedStatusResult> {
  const startTime = Date.now();
  const result: BlockedStatusResult = {
    issuesUpdated: 0,
    dependenciesResolved: 0,
    errors: []
  };
  
  const payload = github.context.payload;
  
  if (payload.action !== 'closed' || !payload.issue) {
    core.info('No relevant issue closed event found');
    return result;
  }
  
  const closedIssue = payload.issue;
  core.info(`Processing closed issue: #${closedIssue.number} - "${closedIssue.title}"`);
  
  try {
    const { unblockableIssues, metrics } = await findUnblockableIssuesBatch(githubApi, [closedIssue.number]);
    
    core.info(`Found ${unblockableIssues.length} issues that could be unblocked (scanned ${metrics.issuesScanned} issues in ${metrics.processingTimeMs}ms)`);
    
    if (metrics.cyclesDetected > 0) {
      core.warning(`Detected ${metrics.cyclesDetected} circular dependencies during processing`);
    }
    
    // Process unblockable issues in batches for better performance
    const batchSize = 10;
    for (let i = 0; i < unblockableIssues.length; i += batchSize) {
      const batch = unblockableIssues.slice(i, i + batchSize);
      
      await Promise.allSettled(batch.map(async (issue) => {
        try {
          if (!issue.body) return;
          
          const parsed = parseIssueBody(issue.body);
          const newDependencyLabels = updateDependencyLabels(parsed.dependencies);
          
          await updateIssueStatus(githubApi, issue, newDependencyLabels);
          result.issuesUpdated++;
          
          if (newDependencyLabels.includes('ready')) {
            result.dependenciesResolved++;
          }
        } catch (error) {
          const errorMsg = `Failed to update issue #${issue.number}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          core.error(errorMsg);
        }
      }));
    }
    
    // Add performance metrics
    result.performanceMetrics = {
      processingTimeMs: Date.now() - startTime,
      issuesScanned: metrics.issuesScanned,
      dependencyGraphSize: metrics.dependencyGraphSize,
      cyclesDetected: metrics.cyclesDetected
    };
    
  } catch (error) {
    const errorMsg = `Failed to process webhook mode: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    core.error(errorMsg);
  }
  
  return result;
}

/**
 * Process blocked status management for full scan mode (all issues)
 * Enhanced with dependency graph analysis and optimized batch processing
 */
async function processFullScanMode(githubApi: EnhancedGitHubApi): Promise<BlockedStatusResult> {
  const startTime = Date.now();
  const result: BlockedStatusResult = {
    issuesUpdated: 0,
    dependenciesResolved: 0,
    errors: []
  };

  let artifactManager: ArtifactManager | null = null;
  let artifactId: string | undefined;
  
  try {
    // Initialize artifact manager for large-scale operations
    artifactManager = createArtifactManager();
    
    // Get all open issues with taskmaster label
    const openIssues = await githubApi.listIssues({
      state: 'open',
      labels: 'taskmaster'
    });
    
    core.info(`Scanning ${openIssues.length} open issues for dependency status updates`);
    
    // For large PRDs (500+ tasks), upload current state as artifact
    if (openIssues.length >= 500) {
      try {
        const taskGraph = {
          issues: openIssues.map(issue => ({
            number: issue.number,
            title: issue.title,
            body: issue.body,
            labels: issue.labels,
            state: issue.state
          })),
          metadata: {
            scanType: 'full-scan',
            timestamp: new Date(),
            issueCount: openIssues.length
          }
        };
        
        artifactId = await artifactManager.uploadTaskGraph(taskGraph, {
          sourcePath: 'dependency-scan',
          totalTasks: openIssues.length
        });
        
        core.info(`✅ Uploaded task graph artifact for large PRD: ${artifactId}`);
      } catch (error) {
        core.warning(`Failed to upload task graph artifact: ${error instanceof Error ? error.message : String(error)}`);
        // Continue processing even if artifact upload fails
      }
    }
    
    // Parse all issues and build dependency graph
    const parsedIssues: ParsedIssueData[] = [];
    for (const issue of openIssues) {
      if (!issue.body) continue;
      
      try {
        const parsed = parseIssueBody(issue.body);
        // Add issue number if not in YAML front-matter
        if (!parsed.yamlFrontMatter.id) {
          parsed.yamlFrontMatter.id = issue.number;
        }
        parsedIssues.push(parsed);
      } catch (parseError) {
        core.warning(`Failed to parse issue #${issue.number}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
    
    // Build dependency graph and analyze
    const graph = DependencyGraphAnalyzer.buildDependencyGraph(parsedIssues);
    const cycles = DependencyGraphAnalyzer.detectCircularDependencies(graph);
    const resolutionOrder = DependencyGraphAnalyzer.getDependencyResolutionOrder(graph);
    
    if (cycles.length > 0) {
      core.warning(`Detected ${cycles.length} circular dependencies: ${cycles.map(c => c.description).join(', ')}`);
    }
    
    core.info(`Dependency graph analysis: ${graph.size} nodes, ${resolutionOrder.resolvedNodes}/${resolutionOrder.totalNodes} resolvable`);
    
    // Process issues in dependency resolution order for optimal efficiency
    const issuesToProcess = resolutionOrder.order
      .map(id => openIssues.find(issue => issue.number === id))
      .filter((issue): issue is ApiIssue => Boolean(issue));
    
    // Use optimized batch processing with adaptive sizing
    const batchResult = await githubApi.processBatch(
      issuesToProcess,
      async (issue) => {
        if (!issue.body) return null;
        
        const parsed = parseIssueBody(issue.body);
        const dependencies = parsed.dependencies;
        
        if (dependencies.length === 0) return null;
        
        const newDependencyLabels = updateDependencyLabels(dependencies);
        const currentLabels = issue.labels?.map((label: any) => 
          typeof label === 'string' ? label : label.name
        ).filter((label: any): label is string => Boolean(label)) || [];
        
        // Check if labels need updating
        const hasBlocked = currentLabels.some((label: string) => label.startsWith('blocked'));
        const hasReady = currentLabels.includes('ready');
        const shouldBeBlocked = newDependencyLabels.some(label => label.startsWith('blocked'));
        const shouldBeReady = newDependencyLabels.includes('ready');
        
        if ((hasBlocked !== shouldBeBlocked) || (hasReady !== shouldBeReady)) {
          await updateIssueStatus(githubApi, issue, newDependencyLabels);
          
          return {
            issueNumber: issue.number,
            updated: true,
            wasReady: hasReady,
            isReady: shouldBeReady
          };
        }
        
        return null;
      },
      {
        operationType: 'dependency-status-update',
        priority: OperationPriority.HIGH,
        enableCheckpointing: openIssues.length >= 100,
        checkpointCallback: artifactManager ? async (checkpoint: ProcessingCheckpoint) => {
          await artifactManager!.saveCheckpoint(artifactId || 'unknown', checkpoint, {
            scanType: 'full-scan',
            resolutionOrder: resolutionOrder.order
          });
        } : undefined
      }
    );
    
    // Process successful results
    for (const { result: updateResult } of batchResult.successful) {
      if (updateResult && updateResult.updated) {
        result.issuesUpdated++;
        
        if (updateResult.isReady && !updateResult.wasReady) {
          result.dependenciesResolved++;
        }
      }
    }
    
    // Process failed results
    for (const { item, error } of batchResult.failed) {
      const errorMsg = `Failed to process issue #${(item as ApiIssue).number}: ${error.message}`;
      result.errors.push(errorMsg);
      core.error(errorMsg);
    }
    
    // Handle failed operations with replay capability
    if (batchResult.failed.length > 0 && artifactManager && artifactId) {
      try {
        const replayId = await artifactManager.createReplayData(
          artifactId,
          {
            totalItems: issuesToProcess.length,
            processedItems: batchResult.successful.length + batchResult.failed.length,
            completedItems: batchResult.successful.length,
            failedItems: batchResult.failed.length,
            currentBatchSize: batchResult.metrics.batchSize,
            startTime: new Date(startTime),
            lastUpdateTime: new Date(),
            estimatedCompletionTime: new Date()
          },
          batchResult.failed.map(({ item, error }) => ({
            operation: 'update-dependency-status',
            data: { issueNumber: (item as ApiIssue).number, issue: item },
            error: error.message
          }))
        );
        
        core.info(`Created replay data for ${batchResult.failed.length} failed operations: ${replayId}`);
      } catch (error) {
        core.warning(`Failed to create replay data: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Add performance metrics
    result.performanceMetrics = {
      processingTimeMs: Date.now() - startTime,
      issuesScanned: openIssues.length,
      dependencyGraphSize: graph.size,
      cyclesDetected: cycles.length,
      batchMetrics: batchResult.metrics,
      artifactId
    };
    
    // Generate performance report for large operations
    if (artifactManager && artifactId && openIssues.length >= 100) {
      try {
        await artifactManager.generatePerformanceReport(artifactId, {
          totalItems: issuesToProcess.length,
          successfulItems: batchResult.successful.length,
          failedItems: batchResult.failed.length,
          processingTimeMs: Date.now() - startTime,
          batchMetrics: [batchResult.metrics],
          errorBreakdown: batchResult.failed.reduce((acc, { error }) => {
            acc[error.category] = (acc[error.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });
        
        core.info(`Performance report generated for operation ${artifactId}`);
      } catch (error) {
        core.warning(`Failed to generate performance report: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
  } catch (error) {
    const errorMsg = `Failed to process full scan mode: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    core.error(errorMsg);
  } finally {
    // Clean up artifact manager
    if (artifactManager) {
      artifactManager.cleanup();
    }
  }
  
  return result;
}

async function run(): Promise<void> {
  try {
    core.info('👁️ Starting Taskmaster Watcher action');

    // Load configuration with priority: defaults < config files < env vars < action inputs
    const config = loadConfig(
      {
        validate: true,
        baseDir: process.cwd()
      },
      {
        // Action input overrides
        githubToken: core.getInput('github-token') || undefined,
        scanMode: (core.getInput('scan-mode') as 'webhook' | 'full') || undefined
      }
    );

    core.info(`📋 Configuration loaded:`);
    core.info(`  • Scan mode: ${config.scanMode}`);
    core.info(`  • Repository: ${github.context.repo.owner}/${github.context.repo.repo}`);

    // Create GitHub API client
    const githubApi = createGitHubApiClient({
      token: config.githubToken,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      debug: false
    });

    let result: BlockedStatusResult;

    // Process based on scan mode
    if (config.scanMode === 'webhook') {
      core.info('🔗 Processing in webhook mode (single issue)');
      result = await processWebhookMode(githubApi);
    } else {
      core.info('🔍 Processing in full scan mode (all issues)');
      result = await processFullScanMode(githubApi);
    }

    // Report results
    core.info(`📊 Results:`);
    core.info(`  • Issues updated: ${result.issuesUpdated}`);
    core.info(`  • Dependencies resolved: ${result.dependenciesResolved}`);
    if (result.errors.length > 0) {
      core.info(`  • Errors encountered: ${result.errors.length}`);
    }

    core.setOutput('issues-updated', result.issuesUpdated.toString());
    core.setOutput('dependencies-resolved', result.dependenciesResolved.toString());
    
    if (result.errors.length > 0) {
      core.warning(`Completed with ${result.errors.length} errors`);
    } else {
      core.info('✅ Taskmaster Watcher completed successfully');
    }
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();