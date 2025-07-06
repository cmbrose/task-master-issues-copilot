/**
 * Artifact Cleanup Action
 * 
 * This action cleans up old artifacts based on retention policies:
 * - Remove artifacts older than the retention period
 * - Keep only the specified maximum number of artifacts
 * - Preserve artifacts from successful runs when configured
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig, TaskmasterConfig } from '../../../scripts/index';

interface ArtifactInfo {
  id: number;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  size_in_bytes: number;
  workflow_run?: {
    id: number;
    conclusion: string | null;
    status: string | null;
  };
  age_days: number;
  should_delete: boolean;
  preservation_reason?: string;
}

interface CleanupSummary {
  total_artifacts: number;
  artifacts_deleted: number;
  artifacts_preserved: number;
  bytes_freed: number;
  dry_run: boolean;
  preservation_reasons: Record<string, number>;
}

/**
 * Calculate the age of an artifact in days
 */
function calculateArtifactAge(createdAt: string | null): number {
  if (!createdAt) {
    return 0; // Return 0 for null dates (shouldn't happen, but handle gracefully)
  }
  
  const now = new Date();
  const created = new Date(createdAt);
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if artifact name matches the given pattern (supports basic wildcards)
 */
function matchesPattern(artifactName: string, pattern: string): boolean {
  // Convert simple glob patterns to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
    
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(artifactName);
}

/**
 * Fetch all artifacts from the repository with metadata
 */
async function fetchArtifacts(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  namePattern: string
): Promise<ArtifactInfo[]> {
  core.info('📦 Fetching repository artifacts...');
  
  const artifacts: ArtifactInfo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    try {
      const response = await octokit.rest.actions.listArtifactsForRepo({
        owner,
        repo,
        per_page: perPage,
        page
      });

      if (response.data.artifacts.length === 0) {
        break;
      }

      for (const artifact of response.data.artifacts) {
        // Skip artifacts that don't match the pattern
        if (!matchesPattern(artifact.name, namePattern)) {
          continue;
        }

        let workflowRun = undefined;
        
        // Try to get workflow run information for preservation logic
        if (artifact.workflow_run && artifact.workflow_run.id) {
          try {
            const runResponse = await octokit.rest.actions.getWorkflowRun({
              owner,
              repo,
              run_id: artifact.workflow_run.id
            });
            workflowRun = {
              id: runResponse.data.id,
              conclusion: runResponse.data.conclusion,
              status: runResponse.data.status
            };
          } catch (error) {
            core.warning(`Could not fetch workflow run ${artifact.workflow_run.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        artifacts.push({
          id: artifact.id,
          name: artifact.name,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at,
          size_in_bytes: artifact.size_in_bytes,
          workflow_run: workflowRun,
          age_days: calculateArtifactAge(artifact.created_at),
          should_delete: false // Will be determined by retention policy
        });
      }

      page++;
    } catch (error) {
      core.error(`Failed to fetch artifacts page ${page}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }

  core.info(`📊 Found ${artifacts.length} artifacts matching pattern '${namePattern}'`);
  return artifacts;
}

/**
 * Apply retention policies to determine which artifacts should be deleted
 */
function applyRetentionPolicies(
  artifacts: ArtifactInfo[],
  retentionDays: number,
  maxArtifactsCount: number,
  preserveSuccessfulRuns: boolean
): ArtifactInfo[] {
  core.info('🔍 Applying retention policies...');
  
  // Sort artifacts by creation date (newest first)
  const sortedArtifacts = [...artifacts].sort((a, b) => {
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bDate - aDate;
  });

  // Apply age-based retention
  for (const artifact of sortedArtifacts) {
    if (artifact.age_days > retentionDays) {
      artifact.should_delete = true;
      artifact.preservation_reason = undefined;
    } else {
      artifact.should_delete = false;
      artifact.preservation_reason = 'within_retention_period';
    }
  }

  // Apply count-based retention (preserve most recent)
  const artifactsToKeep = sortedArtifacts.slice(0, maxArtifactsCount);
  const artifactsToDelete = sortedArtifacts.slice(maxArtifactsCount);
  
  for (const artifact of artifactsToDelete) {
    if (!artifact.should_delete) {
      artifact.should_delete = true;
      artifact.preservation_reason = undefined;
    }
  }
  
  for (const artifact of artifactsToKeep) {
    if (artifact.should_delete && !artifact.preservation_reason) {
      artifact.should_delete = false;
      artifact.preservation_reason = 'recent_artifacts';
    }
  }

  // Apply successful run preservation policy
  if (preserveSuccessfulRuns) {
    for (const artifact of sortedArtifacts) {
      if (artifact.should_delete && 
          artifact.workflow_run && 
          artifact.workflow_run.conclusion === 'success') {
        artifact.should_delete = false;
        artifact.preservation_reason = 'successful_run';
      }
    }
  }

  const toDelete = sortedArtifacts.filter(a => a.should_delete);
  const toPreserve = sortedArtifacts.filter(a => !a.should_delete);
  
  core.info(`📋 Retention policy results:`);
  core.info(`  • ${toDelete.length} artifacts marked for deletion`);
  core.info(`  • ${toPreserve.length} artifacts preserved`);
  
  return sortedArtifacts;
}

/**
 * Delete artifacts marked for deletion
 */
async function deleteArtifacts(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  artifacts: ArtifactInfo[],
  dryRun: boolean
): Promise<CleanupSummary> {
  const artifactsToDelete = artifacts.filter(a => a.should_delete);
  const artifactsToPreserve = artifacts.filter(a => !a.should_delete);
  
  const summary: CleanupSummary = {
    total_artifacts: artifacts.length,
    artifacts_deleted: 0,
    artifacts_preserved: artifactsToPreserve.length,
    bytes_freed: 0,
    dry_run: dryRun,
    preservation_reasons: {}
  };

  // Count preservation reasons
  for (const artifact of artifactsToPreserve) {
    const reason = artifact.preservation_reason || 'unknown';
    summary.preservation_reasons[reason] = (summary.preservation_reasons[reason] || 0) + 1;
  }

  if (artifactsToDelete.length === 0) {
    core.info('✅ No artifacts need to be deleted');
    return summary;
  }

  core.info(`🗑️ ${dryRun ? 'DRY RUN: Would delete' : 'Deleting'} ${artifactsToDelete.length} artifacts...`);

  for (const artifact of artifactsToDelete) {
    if (dryRun) {
      core.info(`  🔍 DRY RUN: Would delete artifact '${artifact.name}' (${artifact.age_days} days old, ${artifact.size_in_bytes} bytes)`);
      summary.bytes_freed += artifact.size_in_bytes;
    } else {
      try {
        await octokit.rest.actions.deleteArtifact({
          owner,
          repo,
          artifact_id: artifact.id
        });
        
        core.info(`  ✅ Deleted artifact '${artifact.name}' (${artifact.age_days} days old, ${artifact.size_in_bytes} bytes)`);
        summary.artifacts_deleted++;
        summary.bytes_freed += artifact.size_in_bytes;
      } catch (error) {
        core.error(`  ❌ Failed to delete artifact '${artifact.name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return summary;
}

/**
 * Log cleanup summary
 */
function logCleanupSummary(summary: CleanupSummary): void {
  const bytesFreedMB = (summary.bytes_freed / (1024 * 1024)).toFixed(2);
  
  core.info('📊 Cleanup Summary:');
  core.info(`  • Total artifacts processed: ${summary.total_artifacts}`);
  core.info(`  • Artifacts ${summary.dry_run ? 'that would be deleted' : 'deleted'}: ${summary.artifacts_deleted}`);
  core.info(`  • Artifacts preserved: ${summary.artifacts_preserved}`);
  core.info(`  • Storage ${summary.dry_run ? 'that would be freed' : 'freed'}: ${bytesFreedMB} MB`);
  core.info(`  • Dry run mode: ${summary.dry_run}`);
  
  if (Object.keys(summary.preservation_reasons).length > 0) {
    core.info('  • Preservation reasons:');
    for (const [reason, count] of Object.entries(summary.preservation_reasons)) {
      core.info(`    - ${reason}: ${count} artifacts`);
    }
  }
}

async function run(): Promise<void> {
  try {
    core.info('🧹 Starting Artifact Cleanup action');

    // Load configuration with priority: defaults < config files < env vars < action inputs
    const config = loadConfig(
      {
        validate: true,
        baseDir: process.cwd()
      },
      {
        // Action input overrides
        githubToken: core.getInput('github-token') || undefined,
        maxArtifactsCount: core.getInput('max-artifacts-count') ? 
          parseInt(core.getInput('max-artifacts-count'), 10) : undefined,
        retentionDays: core.getInput('retention-days') ? 
          parseInt(core.getInput('retention-days'), 10) : undefined
      }
    );

    // Get additional cleanup-specific inputs
    const dryRun = core.getBooleanInput('dry-run');
    const preserveSuccessfulRuns = core.getBooleanInput('preserve-successful-runs');
    const artifactNamePattern = core.getInput('artifact-name-pattern') || 'task-graph*';

    core.info(`📋 Cleanup configuration:`);
    core.info(`  • Retention days: ${config.retentionDays}`);
    core.info(`  • Max artifacts count: ${config.maxArtifactsCount}`);
    core.info(`  • Dry run: ${dryRun}`);
    core.info(`  • Preserve successful runs: ${preserveSuccessfulRuns}`);
    core.info(`  • Artifact name pattern: ${artifactNamePattern}`);

    // Create GitHub API client
    const context = github.context;
    const octokit = github.getOctokit(config.githubToken);

    // Fetch artifacts from repository
    const artifacts = await fetchArtifacts(
      octokit,
      context.repo.owner,
      context.repo.repo,
      artifactNamePattern
    );

    if (artifacts.length === 0) {
      core.info('✅ No artifacts found matching the criteria');
      core.setOutput('artifacts-deleted', '0');
      core.setOutput('artifacts-preserved', '0');
      core.setOutput('cleanup-summary', 'No artifacts found');
      core.setOutput('dry-run-mode', dryRun.toString());
      return;
    }

    // Apply retention policies
    const processedArtifacts = applyRetentionPolicies(
      artifacts,
      config.retentionDays,
      config.maxArtifactsCount,
      preserveSuccessfulRuns
    );

    // Delete artifacts (or simulate in dry-run mode)
    const summary = await deleteArtifacts(
      octokit,
      context.repo.owner,
      context.repo.repo,
      processedArtifacts,
      dryRun
    );

    // Log summary and set outputs
    logCleanupSummary(summary);

    core.setOutput('artifacts-deleted', summary.artifacts_deleted.toString());
    core.setOutput('artifacts-preserved', summary.artifacts_preserved.toString());
    core.setOutput('cleanup-summary', JSON.stringify(summary));
    core.setOutput('dry-run-mode', dryRun.toString());

    core.info('✅ Artifact Cleanup completed successfully');
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();