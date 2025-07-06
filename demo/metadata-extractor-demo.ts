#!/usr/bin/env ts-node

/**
 * Demo script showing metadata extractor usage
 */

import { createGitHubApiClient } from '../scripts/github-api';
import { 
  GitHubMetadataExtractor, 
  createMetadataExtractor,
  IssueMetadata,
  CommentContext,
  LabelCategory
} from '../scripts/metadata-extractor';

function demonstrateMetadataExtraction() {
  console.log('🎯 Demonstrating GitHub Metadata Extractor\n');
  
  // Example 1: Basic setup
  console.log('📝 Example 1: Basic setup and configuration');
  console.log('```typescript');
  console.log(`import { createGitHubApiClient, createMetadataExtractor } from './scripts';

// Create GitHub API client
const githubApi = createGitHubApiClient({
  token: process.env.GITHUB_TOKEN!,
  owner: 'cmbrose',
  repo: 'task-master-issues',
  debug: false
});

// Create metadata extractor
const extractor = createMetadataExtractor(githubApi);`);
  console.log('```\n');

  // Example 2: Extract basic metadata
  console.log('📊 Example 2: Extract basic issue metadata');
  console.log('```typescript');
  console.log(`// Extract basic metadata without comments or heavy analysis
const basicMetadata = await extractor.extractIssueMetadata(250, {
  includeComments: false,
  includeProjectInfo: false,
  buildActivityTimeline: false
});

console.log(\`Issue: #\${basicMetadata.number} - \${basicMetadata.title}\`);
console.log(\`State: \${basicMetadata.state}\`);
console.log(\`Author: \${basicMetadata.author.login}\`);
console.log(\`Labels: \${basicMetadata.labels.map(l => l.name).join(', ')}\`);
console.log(\`Assignees: \${basicMetadata.assignees.map(a => a.login).join(', ')}\`);`);
  console.log('```\n');

  // Example 3: Extract comprehensive metadata
  console.log('🔍 Example 3: Extract comprehensive metadata with all features');
  console.log('```typescript');
  console.log(`// Extract full metadata with all analysis
const fullMetadata = await extractor.extractIssueMetadata(250, {
  includeComments: true,
  includeReactions: true,
  includeLinkedIssues: true,
  includeParsedBody: true,
  maxComments: 100,
  includeCommandHistory: true,
  parseCommands: true,
  analyzeLabelCategories: true,
  extractMentions: true,
  buildActivityTimeline: true,
  useCache: true
});

// Access parsed body content (from existing issue-parser)
const yamlMetadata = fullMetadata.parsedBody.yamlFrontMatter;
const issueMeta = fullMetadata.parsedBody.metadata;
const dependencies = fullMetadata.parsedBody.dependencies;

console.log(\`YAML ID: \${yamlMetadata.id}\`);
console.log(\`Status: \${issueMeta.status}\`);
console.log(\`Dependencies: \${dependencies.length}\`);`);
  console.log('```\n');

  // Example 4: Comment context analysis
  console.log('💬 Example 4: Comment context and command analysis');
  console.log('```typescript');
  console.log(`// Extract only comment context
const commentContext = await extractor.extractCommentContext(250, {
  maxComments: 50,
  includeCommandHistory: true,
  parseCommands: true
});

console.log(\`Total comments: \${commentContext.totalComments}\`);
console.log(\`Unique commenters: \${commentContext.uniqueCommenters}\`);
console.log(\`Commands found: \${commentContext.commandHistory.length}\`);

// Analyze command history
for (const cmd of commentContext.commandHistory) {
  console.log(\`Command: /\${cmd.command} by \${cmd.author.login}\`);
  console.log(\`Arguments: \${JSON.stringify(cmd.arguments)}\`);
  console.log(\`Valid: \${cmd.isValid}\`);
  if (cmd.errors.length > 0) {
    console.log(\`Errors: \${cmd.errors.join(', ')}\`);
  }
}

// Recent activity
const recent = commentContext.recentActivity;
if (recent.lastCommentAt) {
  console.log(\`Last comment: \${recent.lastCommentAt.toISOString()}\`);
  console.log(\`Last commenter: \${recent.lastCommentBy?.login}\`);
}`);
  console.log('```\n');

  // Example 5: Label analysis
  console.log('🏷️ Example 5: Advanced label analysis');
  console.log('```typescript');
  console.log(`// Analyze labels by category
const labelsByCategory = fullMetadata.labels.reduce((acc, label) => {
  const category = label.category || 'unknown';
  if (!acc[category]) acc[category] = [];
  acc[category].push(label);
  return acc;
}, {} as Record<string, LabelInfo[]>);

// Check for specific label categories
const statusLabels = labelsByCategory[LabelCategory.STATUS] || [];
const priorityLabels = labelsByCategory[LabelCategory.PRIORITY] || [];
const taskmasterLabels = fullMetadata.labels.filter(l => l.isTaskmasterLabel);

console.log(\`Status labels: \${statusLabels.map(l => l.name).join(', ')}\`);
console.log(\`Priority labels: \${priorityLabels.map(l => l.name).join(', ')}\`);
console.log(\`Taskmaster labels: \${taskmasterLabels.map(l => l.name).join(', ')}\`);

// Extract priority information
const priorityLabel = priorityLabels[0];
if (priorityLabel?.priority) {
  console.log(\`Priority level: \${priorityLabel.priority}/5\`);
}`);
  console.log('```\n');

  // Example 6: Linked issues and relationships
  console.log('🔗 Example 6: Linked issues and relationships');
  console.log('```typescript');
  console.log(`// Analyze linked issues
const parentIssues = fullMetadata.linkedIssues.filter(i => i.relationship === 'parent');
const childIssues = fullMetadata.linkedIssues.filter(i => i.relationship === 'child');
const dependencies = fullMetadata.linkedIssues.filter(i => i.relationship === 'dependency');
const references = fullMetadata.linkedIssues.filter(i => i.relationship === 'reference');

console.log(\`Parent issues: \${parentIssues.map(i => \`#\${i.number}\`).join(', ')}\`);
console.log(\`Child issues: \${childIssues.map(i => \`#\${i.number}\`).join(', ')}\`);
console.log(\`Dependencies: \${dependencies.map(i => \`#\${i.number}\`).join(', ')}\`);

// Check for mentioned users
const mentions = fullMetadata.mentionedUsers;
console.log(\`Mentioned users: \${mentions.map(u => \`@\${u.login}\`).join(', ')}\`);`);
  console.log('```\n');

  // Example 7: Integration with breakdown command
  console.log('⚙️ Example 7: Integration with breakdown command workflow');
  console.log('```typescript');
  console.log(`// Example: Using metadata for command execution
async function executeBreakdownCommand(issueNumber: number, commandArgs: any) {
  // Extract comprehensive metadata
  const metadata = await extractor.extractIssueMetadata(issueNumber);
  
  // Check if issue is suitable for breakdown
  const canBreakdown = checkBreakdownEligibility(metadata);
  if (!canBreakdown.eligible) {
    throw new Error(\`Cannot breakdown issue: \${canBreakdown.reason}\`);
  }
  
  // Get parent task information from parsed body
  const parentTaskId = metadata.parsedBody.yamlFrontMatter.id;
  const complexity = metadata.parsedBody.metadata.complexity;
  
  // Check for existing command history to avoid duplicates
  const hasRecentBreakdown = metadata.commentContext?.commandHistory.some(cmd => 
    cmd.command === 'breakdown' && 
    Date.now() - cmd.timestamp.getTime() < 3600000 // Within last hour
  );
  
  if (hasRecentBreakdown) {
    console.log('Recent breakdown command found, checking for idempotency...');
  }
  
  // Extract repository context
  const repoInfo = metadata.repository;
  
  // Use metadata for command execution
  return {
    parentTaskId,
    complexity: parseInt(complexity?.split('/')[0] || '5'),
    repository: repoInfo,
    commandHistory: metadata.commentContext?.commandHistory || []
  };
}

function checkBreakdownEligibility(metadata: IssueMetadata) {
  // Check if issue is open
  if (metadata.state !== 'open') {
    return { eligible: false, reason: 'Issue is not open' };
  }
  
  // Check if issue has YAML front-matter with task ID
  if (!metadata.parsedBody.yamlFrontMatter.id) {
    return { eligible: false, reason: 'Issue does not have a task ID in YAML front-matter' };
  }
  
  // Check if issue is already broken down (has child issues)
  const hasChildren = metadata.linkedIssues.some(i => i.relationship === 'child');
  if (hasChildren) {
    return { eligible: false, reason: 'Issue is already broken down into subtasks' };
  }
  
  return { eligible: true };
}`);
  console.log('```\n');

  // Example 8: Performance optimization
  console.log('⚡ Example 8: Performance optimization and caching');
  console.log('```typescript');
  console.log(`// Use caching for better performance
const cachedMetadata = await extractor.extractIssueMetadata(250, {
  useCache: true,
  cacheTimeout: 300000 // 5 minutes
});

// Check cache statistics
const cacheStats = extractor.getCacheStats();
console.log(\`Cache size: \${cacheStats.size}\`);
console.log(\`Cached keys: \${cacheStats.keys.join(', ')}\`);

// Clear cache when needed
extractor.clearCache();

// Extract only what you need for better performance
const lightweightMetadata = await extractor.extractIssueMetadata(250, {
  includeComments: false,      // Skip comments if not needed
  includeProjectInfo: false,   // Skip complex project info
  buildActivityTimeline: false, // Skip timeline construction
  maxComments: 10             // Limit comments if included
});`);
  console.log('```\n');

  // Example 9: Error handling
  console.log('⚠️ Example 9: Error handling and fallbacks');
  console.log('```typescript');
  console.log(`try {
  const metadata = await extractor.extractIssueMetadata(issueNumber);
  
  // Process metadata...
  
} catch (error) {
  if (error.message.includes('404')) {
    console.error('Issue not found');
  } else if (error.message.includes('403')) {
    console.error('Access denied - check token permissions');
  } else if (error.message.includes('rate limit')) {
    console.error('Rate limited - waiting before retry');
    // Implement retry logic
  } else {
    console.error(\`Unexpected error: \${error.message}\`);
  }
  
  // Provide fallback metadata if possible
  const fallbackMetadata = await createFallbackMetadata(issueNumber);
}`);
  console.log('```\n');

  console.log('🎉 Demo completed! The metadata extractor provides comprehensive');
  console.log('   issue information for command execution and workflow automation.');
}

// Run the demonstration
if (require.main === module) {
  demonstrateMetadataExtraction();
}

export { demonstrateMetadataExtraction };