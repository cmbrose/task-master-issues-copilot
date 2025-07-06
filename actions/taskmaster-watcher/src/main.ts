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
  type ParsedIssueData
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
  const currentLabels = issue.labels?.map(label => 
    typeof label === 'string' ? label : label.name
  ).filter((label): label is string => Boolean(label)) || [];
  
  const filteredLabels = currentLabels.filter(label => 
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
 * Enhanced with dependency graph analysis and batch processing
 */
async function processFullScanMode(githubApi: EnhancedGitHubApi): Promise<BlockedStatusResult> {
  const startTime = Date.now();
  const result: BlockedStatusResult = {
    issuesUpdated: 0,
    dependenciesResolved: 0,
    errors: []
  };
  
  try {
    // Get all open issues with taskmaster label
    const openIssues = await githubApi.listIssues({
      state: 'open',
      labels: 'taskmaster'
    });
    
    core.info(`Scanning ${openIssues.length} open issues for dependency status updates`);
    
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
    
    // Process in batches
    const batchSize = 15;
    for (let i = 0; i < issuesToProcess.length; i += batchSize) {
      const batch = issuesToProcess.slice(i, i + batchSize);
      
      await Promise.allSettled(batch.map(async (issue) => {
        try {
          if (!issue.body) return;
          
          const parsed = parseIssueBody(issue.body);
          const dependencies = parsed.dependencies;
          
          if (dependencies.length === 0) return;
          
          const newDependencyLabels = updateDependencyLabels(dependencies);
          const currentLabels = issue.labels?.map(label => 
            typeof label === 'string' ? label : label.name
          ).filter((label): label is string => Boolean(label)) || [];
          
          // Check if labels need updating
          const hasBlocked = currentLabels.some(label => label.startsWith('blocked'));
          const hasReady = currentLabels.includes('ready');
          const shouldBeBlocked = newDependencyLabels.some(label => label.startsWith('blocked'));
          const shouldBeReady = newDependencyLabels.includes('ready');
          
          if ((hasBlocked !== shouldBeBlocked) || (hasReady !== shouldBeReady)) {
            await updateIssueStatus(githubApi, issue, newDependencyLabels);
            result.issuesUpdated++;
            
            if (shouldBeReady && !hasReady) {
              result.dependenciesResolved++;
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process issue #${issue.number}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          core.error(errorMsg);
        }
      }));
    }
    
    // Add performance metrics
    result.performanceMetrics = {
      processingTimeMs: Date.now() - startTime,
      issuesScanned: openIssues.length,
      dependencyGraphSize: graph.size,
      cyclesDetected: cycles.length
    };
    
  } catch (error) {
    const errorMsg = `Failed to process full scan mode: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    core.error(errorMsg);
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