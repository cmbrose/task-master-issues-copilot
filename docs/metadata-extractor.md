# GitHub Issue Metadata Extractor

The GitHub Issue Metadata Extractor provides comprehensive extraction of GitHub issue metadata, including labels, assignees, project information, comment context, and other GitHub-specific metadata needed for command execution and workflow automation.

## Overview

This module complements the existing issue body parser and comment parser by extracting metadata directly from the GitHub API, providing a complete picture of issue context for command execution workflows.

## Features

### 🔍 Comprehensive Metadata Extraction
- **Issue Information**: Basic issue data (title, body, state, timestamps)
- **User Context**: Author, assignees, and mentioned users  
- **Labels & Categories**: Advanced label analysis with automatic categorization
- **Project Integration**: Milestone and project information
- **Reactions & Engagement**: Reaction counts and engagement metrics

### 💬 Comment Context Analysis
- **Comment History**: Complete comment timeline with metadata
- **Command Detection**: Automatic command parsing from comments
- **Activity Analysis**: Recent activity patterns and participant tracking
- **Mention Extraction**: User mentions across comments and issue body

### 🔗 Relationship Mapping
- **Linked Issues**: Parent-child relationships and dependencies
- **Reference Detection**: Issue references and cross-linking
- **Hierarchy Analysis**: Task depth and relationship validation

### 🏷️ Advanced Label Analysis
- **Category Classification**: Automatic label categorization (status, priority, complexity, etc.)
- **Taskmaster Integration**: Special handling for Taskmaster-specific labels
- **Priority Extraction**: Numeric priority extraction from labels

### ⚡ Performance & Reliability
- **Smart Caching**: Configurable caching with TTL for performance
- **Rate Limit Handling**: Integrated with enhanced GitHub API client
- **Error Recovery**: Robust error handling with fallback mechanisms
- **Batch Processing**: Efficient processing of multiple issues

## Installation

The metadata extractor is included in the main package:

```bash
npm install
```

## Basic Usage

### Quick Start

```typescript
import { createGitHubApiClient, createMetadataExtractor } from './scripts';

// Create GitHub API client
const githubApi = createGitHubApiClient({
  token: process.env.GITHUB_TOKEN!,
  owner: 'cmbrose',
  repo: 'task-master-issues'
});

// Create metadata extractor
const extractor = createMetadataExtractor(githubApi);

// Extract basic metadata
const metadata = await extractor.extractIssueMetadata(250, {
  includeComments: false,
  includeProjectInfo: false
});

console.log(`Issue: #${metadata.number} - ${metadata.title}`);
console.log(`Labels: ${metadata.labels.map(l => l.name).join(', ')}`);
```

### Comprehensive Extraction

```typescript
// Extract full metadata with all features
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
const dependencies = fullMetadata.parsedBody.dependencies;

console.log(`Task ID: ${yamlMetadata.id}`);
console.log(`Dependencies: ${dependencies.length}`);
```

### Comment Context Only

```typescript
// Extract only comment context
const commentContext = await extractor.extractCommentContext(250, {
  maxComments: 50,
  includeCommandHistory: true,
  parseCommands: true
});

console.log(`Comments: ${commentContext.totalComments}`);
console.log(`Commands: ${commentContext.commandHistory.length}`);
```

## API Reference

### Main Classes

#### `GitHubMetadataExtractor`

The main class for extracting metadata from GitHub issues.

```typescript
class GitHubMetadataExtractor {
  constructor(githubApi: EnhancedGitHubApi)
  
  async extractIssueMetadata(
    issueNumber: number,
    options?: MetadataExtractionOptions
  ): Promise<IssueMetadata>
  
  async extractCommentContext(
    issueNumber: number,
    options?: MetadataExtractionOptions  
  ): Promise<CommentContext>
  
  clearCache(): void
  getCacheStats(): { size: number; keys: string[] }
}
```

### Configuration Options

```typescript
interface MetadataExtractionOptions {
  // Content inclusion
  includeComments?: boolean;        // Include comment analysis
  includeReactions?: boolean;       // Include reaction data
  includeLinkedIssues?: boolean;    // Find linked issues
  includeProjectInfo?: boolean;     // Include project data
  includeParsedBody?: boolean;      // Use existing issue parser
  
  // Comment options
  maxComments?: number;             // Limit number of comments
  includeCommandHistory?: boolean;  // Parse command history
  parseCommands?: boolean;          // Extract commands from comments
  
  // Analysis options
  analyzeLabelCategories?: boolean; // Categorize labels
  extractMentions?: boolean;        // Find mentioned users
  buildActivityTimeline?: boolean;  // Build activity timeline
  
  // Performance options
  useCache?: boolean;               // Enable caching
  cacheTimeout?: number;            // Cache TTL in ms
}
```

### Data Structures

#### `IssueMetadata`

```typescript
interface IssueMetadata {
  // Basic information
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: UserInfo;
  assignees: UserInfo[];
  
  // Labels and categorization
  labels: LabelInfo[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Related content
  linkedIssues: LinkedIssue[];
  mentionedUsers: UserInfo[];
  parsedBody: any; // From issue-parser
  
  // Repository context
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  
  // Comment context (if requested)
  commentContext?: CommentContext;
}
```

#### `CommentContext`

```typescript
interface CommentContext {
  comments: CommentInfo[];
  totalComments: number;
  
  recentActivity: {
    lastCommentAt?: Date;
    lastCommentBy?: UserInfo;
    recentCommenters: UserInfo[];
  };
  
  commandHistory: CommandInfo[];
  participants: UserInfo[];
  activityTimeline: ActivityEvent[];
}
```

#### `LabelInfo`

```typescript
interface LabelInfo {
  name: string;
  color: string;
  description?: string;
  
  // Enhanced analysis
  category?: LabelCategory;
  priority?: number;
  isTaskmasterLabel: boolean;
}

enum LabelCategory {
  STATUS = 'status',
  PRIORITY = 'priority',
  COMPLEXITY = 'complexity',
  TYPE = 'type',
  DEPENDENCY = 'dependency',
  HIERARCHY = 'hierarchy',
  TASKMASTER = 'taskmaster',
  CUSTOM = 'custom'
}
```

## Integration Examples

### Command Execution Context

```typescript
// Build comprehensive context for breakdown command
async function buildBreakdownContext(issueNumber: number, commentBody: string) {
  const extractor = createMetadataExtractor(githubApi);
  
  // Parse command
  const commandResult = parseBreakdownCommand(commentBody);
  if (!commandResult.found) {
    throw new Error('No breakdown command found');
  }
  
  // Extract metadata
  const metadata = await extractor.extractIssueMetadata(issueNumber, {
    includeComments: true,
    includeParsedBody: true,
    includeCommandHistory: true
  });
  
  // Validate eligibility
  const canBreakdown = validateBreakdownEligibility(metadata);
  if (!canBreakdown.eligible) {
    throw new Error(`Cannot breakdown: ${canBreakdown.reason}`);
  }
  
  return {
    command: commandResult.command,
    metadata,
    taskInfo: extractTaskInfo(metadata),
    validation: canBreakdown
  };
}
```

### Label-based Workflow Routing

```typescript
async function routeByLabels(issueNumber: number) {
  const metadata = await extractor.extractIssueMetadata(issueNumber, {
    analyzeLabelCategories: true
  });
  
  // Route based on label categories
  const statusLabels = metadata.labels.filter(l => l.category === 'STATUS');
  const priorityLabels = metadata.labels.filter(l => l.category === 'PRIORITY');
  
  if (statusLabels.some(l => l.name === 'blocked')) {
    return 'blocked-workflow';
  }
  
  if (priorityLabels.some(l => l.priority >= 4)) {
    return 'high-priority-workflow';
  }
  
  return 'default-workflow';
}
```

## Testing

Run the metadata extractor tests:

```bash
# Run test suite
npm run test:metadata-extractor

# Run demos
npm run demo:metadata-extractor
npm run demo:metadata-integration
```

## Performance Considerations

### Caching Strategy

```typescript
// Use caching for frequently accessed issues
const metadata = await extractor.extractIssueMetadata(issueNumber, {
  useCache: true,
  cacheTimeout: 300000 // 5 minutes
});

// Check cache status
const stats = extractor.getCacheStats();
console.log(`Cache size: ${stats.size} items`);
```

### Selective Extraction

```typescript
// Extract only what you need for better performance
const lightMetadata = await extractor.extractIssueMetadata(issueNumber, {
  includeComments: false,      // Skip heavy comment processing
  includeProjectInfo: false,   // Skip complex project API calls
  buildActivityTimeline: false, // Skip timeline construction
  maxComments: 10             // Limit comments if needed
});
```

## Error Handling

```typescript
try {
  const metadata = await extractor.extractIssueMetadata(issueNumber);
} catch (error) {
  if (error.message.includes('404')) {
    console.error('Issue not found');
  } else if (error.message.includes('rate limit')) {
    console.error('Rate limited - implement retry logic');
  } else {
    console.error(`Extraction failed: ${error.message}`);
  }
}
```

## Contributing

The metadata extractor is designed to be extensible. Key areas for enhancement:

1. **Project Integration**: Improve GitHub Projects v2 API integration
2. **Performance**: Optimize batch processing for multiple issues
3. **Analysis**: Add more sophisticated label and relationship analysis
4. **Caching**: Implement persistent caching options

## Related Documentation

- [Issue Parser Documentation](./yaml-parser.md)
- [Comment Parser Documentation](./comment-parser.md)
- [GitHub API Integration](./github-api-integration.md)
- [Label and Hierarchy Management](./label-hierarchy-management.md)