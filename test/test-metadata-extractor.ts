#!/usr/bin/env ts-node

/**
 * Test script for metadata extractor functionality
 */

import { createGitHubApiClient } from '../scripts/github-api';
import { 
  GitHubMetadataExtractor, 
  createMetadataExtractor,
  extractBasicIssueMetadata,
  extractCommentContextOnly
} from '../scripts/metadata-extractor';

// Test configuration
const TEST_CONFIG = {
  owner: process.env.GITHUB_OWNER || 'cmbrose',
  repo: process.env.GITHUB_REPO || 'task-master-issues',
  token: process.env.GITHUB_TOKEN || '',
  testIssueNumber: parseInt(process.env.TEST_ISSUE_NUMBER || '250', 10)
};

async function testMetadataExtraction() {
  console.log('🧪 Testing GitHub Metadata Extractor\n');

  if (!TEST_CONFIG.token) {
    console.log('❌ GITHUB_TOKEN environment variable is required');
    return;
  }

  try {
    // Create GitHub API client
    const githubApi = createGitHubApiClient({
      token: TEST_CONFIG.token,
      owner: TEST_CONFIG.owner,
      repo: TEST_CONFIG.repo,
      debug: true
    });

    // Test basic connection
    console.log('🔍 Testing GitHub API connection...');
    const rateLimitInfo = await githubApi.getRateLimitStatus();
    console.log(`✅ Connected to GitHub API. Rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}\n`);

    // Create metadata extractor
    const extractor = createMetadataExtractor(githubApi);

    // Test 1: Extract basic issue metadata
    console.log('📊 Test 1: Extracting basic issue metadata...');
    try {
      const basicMetadata = await extractBasicIssueMetadata(githubApi, TEST_CONFIG.testIssueNumber);
      console.log(`✅ Basic metadata extracted for issue #${basicMetadata.number}: "${basicMetadata.title}"`);
      console.log(`   State: ${basicMetadata.state}`);
      console.log(`   Author: ${basicMetadata.author.login}`);
      console.log(`   Labels: ${basicMetadata.labels.map(l => l.name).join(', ')}`);
      console.log(`   Assignees: ${basicMetadata.assignees.map(a => a.login).join(', ')}`);
      console.log(`   Comments: ${basicMetadata.commentCount}`);
      console.log(`   Created: ${basicMetadata.createdAt.toISOString()}`);
      
      if (basicMetadata.parsedBody) {
        console.log(`   Has YAML front-matter: ${Object.keys(basicMetadata.parsedBody.yamlFrontMatter).length > 0}`);
        console.log(`   Metadata fields: ${Object.keys(basicMetadata.parsedBody.metadata).join(', ')}`);
        console.log(`   Dependencies: ${basicMetadata.parsedBody.dependencies.length}`);
      }
    } catch (error) {
      console.log(`❌ Failed to extract basic metadata: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();

    // Test 2: Extract comment context
    console.log('💬 Test 2: Extracting comment context...');
    try {
      const commentContext = await extractCommentContextOnly(githubApi, TEST_CONFIG.testIssueNumber, 20);
      console.log(`✅ Comment context extracted`);
      console.log(`   Total comments: ${commentContext.totalComments}`);
      console.log(`   Unique commenters: ${commentContext.uniqueCommenters}`);
      console.log(`   Commands found: ${commentContext.commandHistory.length}`);
      console.log(`   Participants: ${commentContext.participants.map(p => p.login).join(', ')}`);
      
      if (commentContext.recentActivity.lastCommentAt) {
        console.log(`   Last comment: ${commentContext.recentActivity.lastCommentAt.toISOString()} by ${commentContext.recentActivity.lastCommentBy?.login}`);
      }

      // Show command history
      if (commentContext.commandHistory.length > 0) {
        console.log(`   Command history:`);
        for (const cmd of commentContext.commandHistory.slice(0, 3)) {
          console.log(`     - /${cmd.command} by ${cmd.author.login} at ${cmd.timestamp.toISOString()}`);
          if (cmd.errors.length > 0) {
            console.log(`       Errors: ${cmd.errors.join(', ')}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Failed to extract comment context: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();

    // Test 3: Extract comprehensive metadata
    console.log('🔍 Test 3: Extracting comprehensive metadata...');
    try {
      const fullMetadata = await extractor.extractIssueMetadata(TEST_CONFIG.testIssueNumber, {
        includeComments: true,
        includeReactions: true,
        includeLinkedIssues: true,
        includeParsedBody: true,
        maxComments: 10,
        includeCommandHistory: true,
        parseCommands: true,
        analyzeLabelCategories: true,
        extractMentions: true,
        buildActivityTimeline: true,
        useCache: false // Don't use cache for testing
      });

      console.log(`✅ Comprehensive metadata extracted`);
      console.log(`   Issue: #${fullMetadata.number} - ${fullMetadata.title}`);
      console.log(`   Repository: ${fullMetadata.repository.fullName}`);
      console.log(`   Is Pull Request: ${fullMetadata.isPullRequest}`);
      console.log(`   Is Locked: ${fullMetadata.isLocked}`);
      
      // Analyze labels
      console.log(`   Label analysis:`);
      const labelsByCategory = fullMetadata.labels.reduce((acc, label) => {
        const category = label.category || 'unknown';
        if (!acc[category]) acc[category] = [];
        acc[category].push(label.name);
        return acc;
      }, {} as Record<string, string[]>);
      
      for (const [category, labels] of Object.entries(labelsByCategory)) {
        console.log(`     ${category}: ${labels.join(', ')}`);
      }

      // Show linked issues
      if (fullMetadata.linkedIssues.length > 0) {
        console.log(`   Linked issues:`);
        for (const linked of fullMetadata.linkedIssues.slice(0, 3)) {
          console.log(`     - #${linked.number} (${linked.relationship})`);
        }
      }

      // Show mentioned users
      if (fullMetadata.mentionedUsers.length > 0) {
        console.log(`   Mentioned users: ${fullMetadata.mentionedUsers.map(u => `@${u.login}`).join(', ')}`);
      }

      // Show reactions
      const reactions = fullMetadata.reactions;
      if (reactions.totalCount > 0) {
        console.log(`   Reactions: ${reactions.totalCount} total (+1: ${reactions.plusOne}, eyes: ${reactions.eyes})`);
      }

    } catch (error) {
      console.log(`❌ Failed to extract comprehensive metadata: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();

    // Test 4: Cache functionality
    console.log('💾 Test 4: Testing cache functionality...');
    try {
      const startTime = Date.now();
      await extractor.extractIssueMetadata(TEST_CONFIG.testIssueNumber, { useCache: true });
      const firstCallTime = Date.now() - startTime;

      const cachedStartTime = Date.now();
      await extractor.extractIssueMetadata(TEST_CONFIG.testIssueNumber, { useCache: true });
      const cachedCallTime = Date.now() - cachedStartTime;

      console.log(`✅ Cache test completed`);
      console.log(`   First call: ${firstCallTime}ms`);
      console.log(`   Cached call: ${cachedCallTime}ms`);
      console.log(`   Cache stats: ${JSON.stringify(extractor.getCacheStats())}`);

      // Clear cache
      extractor.clearCache();
      console.log(`   Cache cleared`);
    } catch (error) {
      console.log(`❌ Cache test failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();

    // Test 5: Error handling
    console.log('⚠️  Test 5: Testing error handling...');
    try {
      await extractor.extractIssueMetadata(999999); // Non-existent issue
      console.log(`❌ Error handling test failed - should have thrown an error`);
    } catch (error) {
      console.log(`✅ Error handling test passed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n🎉 All metadata extractor tests completed!');

  } catch (error) {
    console.error(`❌ Test suite failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testMetadataExtraction().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testMetadataExtraction };