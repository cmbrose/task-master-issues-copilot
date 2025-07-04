/**
 * Taskmaster Watcher Action
 * 
 * This action watches for issue changes and updates dependencies/blocked status.
 * Triggered by issue closed events and cron schedules.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as yaml from 'js-yaml';

interface IssueFrontMatter {
  id?: string | number;
  parent?: string | number;
  dependencies?: (string | number)[];
  dependents?: (string | number)[];
  status?: string;
  priority?: string;
}

// Helper to parse YAML front-matter from issue body
function parseYamlFrontMatter(body: string): { frontMatter: IssueFrontMatter; content: string } {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = body.match(frontMatterRegex);
  
  if (match) {
    try {
      const frontMatter = yaml.load(match[1]) as IssueFrontMatter;
      return { frontMatter: frontMatter || {}, content: match[2] };
    } catch (e) {
      core.warning(`Failed to parse YAML front-matter: ${e}`);
      return { frontMatter: {}, content: body };
    }
  }
  
  return { frontMatter: {}, content: body };
}

// Helper to find dependent issues based on YAML front-matter
async function findDependentIssues(octokit: any, closedIssueId: string | number): Promise<any[]> {
  try {
    // Get all issues with taskmaster label
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      labels: 'taskmaster',
      state: 'open',
      per_page: 100,
    });

    const dependentIssues = [];

    for (const issue of issues) {
      if (!issue.body) continue;
      
      const { frontMatter } = parseYamlFrontMatter(issue.body);
      
      // Check if this issue depends on the closed issue
      if (frontMatter.dependencies?.includes(closedIssueId)) {
        dependentIssues.push(issue);
      }
    }

    return dependentIssues;
  } catch (error) {
    core.error(`Failed to find dependent issues: ${error}`);
    return [];
  }
}

// Helper to check if all dependencies of an issue are closed
async function areAllDependenciesClosed(octokit: any, issue: any): Promise<boolean> {
  const { frontMatter } = parseYamlFrontMatter(issue.body || '');
  
  if (!frontMatter.dependencies?.length) {
    return true; // No dependencies means not blocked
  }

  try {
    // Get all issues with taskmaster label  
    const { data: allIssues } = await octokit.rest.issues.listForRepo({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      labels: 'taskmaster',
      state: 'all',
      per_page: 100,
    });

    // Create a map of issue ID to issue for quick lookup
    const issueMap = new Map();
    for (const iss of allIssues) {
      if (!iss.body) continue;
      const { frontMatter: fm } = parseYamlFrontMatter(iss.body);
      if (fm.id) {
        issueMap.set(String(fm.id), iss);
      }
    }

    // Check if all dependencies are closed
    for (const depId of frontMatter.dependencies) {
      const depIssue = issueMap.get(String(depId));
      if (!depIssue || depIssue.state !== 'closed') {
        return false;
      }
    }

    return true;
  } catch (error) {
    core.error(`Failed to check dependencies for issue #${issue.number}: ${error}`);
    return false;
  }
}

// Helper to update blocked label on an issue
async function updateBlockedLabel(octokit: any, issue: any, shouldBeBlocked: boolean): Promise<boolean> {
  const currentLabels = issue.labels?.map((l: any) => typeof l === 'string' ? l : l.name) || [];
  const hasBlockedLabel = currentLabels.includes('blocked');
  
  if (shouldBeBlocked && !hasBlockedLabel) {
    try {
      await octokit.rest.issues.addLabels({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        labels: ['blocked'],
      });
      core.info(`Added 'blocked' label to issue #${issue.number}`);
      return true;
    } catch (error) {
      core.warning(`Failed to add 'blocked' label to issue #${issue.number}: ${error}`);
      return false;
    }
  } else if (!shouldBeBlocked && hasBlockedLabel) {
    try {
      await octokit.rest.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue.number,
        name: 'blocked',
      });
      core.info(`Removed 'blocked' label from issue #${issue.number}`);
      return true;
    } catch (error) {
      core.warning(`Failed to remove 'blocked' label from issue #${issue.number}: ${error}`);
      return false;
    }
  }
  
  return false; // No change made
}

async function run(): Promise<void> {
  try {
    core.info('👁️ Starting Taskmaster Watcher action');

    const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    const scanMode = core.getInput('scan-mode') || 'webhook';

    if (!githubToken) {
      core.setFailed('github-token is required');
      return;
    }

    const octokit = github.getOctokit(githubToken);

    core.info(`📋 Configuration loaded:`);
    core.info(`  • Scan mode: ${scanMode}`);

    let issuesUpdated = 0;
    let dependenciesResolved = 0;

    if (scanMode === 'webhook' && github.context.eventName === 'issues') {
      // Handle single issue closure from webhook
      const payload = github.context.payload;
      if (payload.action === 'closed' && payload.issue) {
        core.info(`Processing closed issue #${payload.issue.number}`);
        
        // Parse the closed issue's front-matter to get its ID
        const { frontMatter } = parseYamlFrontMatter(payload.issue.body || '');
        if (frontMatter.id) {
          // Find all issues that depend on this closed issue
          const dependentIssues = await findDependentIssues(octokit, frontMatter.id);
          core.info(`Found ${dependentIssues.length} dependent issues`);

          for (const depIssue of dependentIssues) {
            const allDepsClosed = await areAllDependenciesClosed(octokit, depIssue);
            if (allDepsClosed) {
              const updated = await updateBlockedLabel(octokit, depIssue, false);
              if (updated) {
                issuesUpdated++;
                dependenciesResolved++;
              }
            }
          }
        }
      }
    } else if (scanMode === 'full') {
      // Full scan mode - check all open issues with blocked label
      core.info('Performing full scan of blocked issues');
      
      try {
        const { data: blockedIssues } = await octokit.rest.issues.listForRepo({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          labels: 'blocked,taskmaster',
          state: 'open',
          per_page: 100,
        });

        core.info(`Found ${blockedIssues.length} blocked issues to check`);

        for (const issue of blockedIssues) {
          const allDepsClosed = await areAllDependenciesClosed(octokit, issue);
          if (allDepsClosed) {
            const updated = await updateBlockedLabel(octokit, issue, false);
            if (updated) {
              issuesUpdated++;
              dependenciesResolved++;
            }
          }
        }
      } catch (error) {
        core.error(`Error during full scan: ${error}`);
      }
    }

    core.setOutput('issues-updated', issuesUpdated.toString());
    core.setOutput('dependencies-resolved', dependenciesResolved.toString());
    
    core.info(`✅ Taskmaster Watcher completed successfully`);
    core.info(`  • Issues updated: ${issuesUpdated}`);
    core.info(`  • Dependencies resolved: ${dependenciesResolved}`);
  } catch (error) {
    const errorMessage = `Action failed: ${error instanceof Error ? error.message : String(error)}`;
    core.setFailed(errorMessage);
    core.error(errorMessage);
  }
}

run();