# Preview Comment Generation Feature

This document describes the new Preview Comment Generation feature that creates markdown-formatted task graph previews as pull request comments.

## Overview

The Preview Comment Generation feature automatically generates human-readable markdown previews of task graphs and posts them as comments on pull requests. This helps reviewers understand the scope and structure of changes to PRD files.

## Features

### 🎯 Core Functionality
- **Markdown Formatting**: Converts task graph JSON into rich markdown with visual indicators
- **PR Comment Management**: Automatically posts and updates preview comments on pull requests
- **Deduplication**: Replaces existing preview comments to avoid spam
- **Smart Formatting**: Adjusts detail level based on task graph size

### 📊 Visual Elements
- **Task Hierarchy**: Organized tree structure with proper indentation
- **Complexity Scores**: Color-coded indicators (🟢 Low, 🟡 Medium, 🔴 High)
- **Blocked Status**: Clear status indicators (✅ Completed, 🟢 Ready, 🚫 Blocked)
- **Priority Levels**: Priority badges (🔥 Critical, ⚠️ High, 📝 Medium, 📋 Low)
- **Dependencies**: Shows blocking relationships and dependencies
- **Collapsible Sections**: Better UX for large task graphs

### 🔧 Smart Behavior
- **Auto-sizing**: Uses compact format for large task graphs (>15 tasks)
- **Collapsible Sections**: Automatically enabled for graphs with >5 tasks
- **Detail Level**: Shows full details only for smaller graphs (≤10 tasks)
- **PRD Detection**: Only posts comments when PRD files are changed

## Integration Points

### GitHub Actions Workflow
The feature is integrated into the `taskmaster-generate` workflow:

```yaml
# .github/workflows/taskmaster-generate.yml
on:
  pull_request:
    paths:
      - 'docs/**.prd.md'
      - 'docs/**/*.prd.md'
    types: [opened, synchronize, reopened]
```

### Dry-Run Mode
Preview comments are generated during dry-run mode (pull request events):
- Task graph is generated but no issues are created
- Markdown preview is posted as a PR comment
- Existing preview comments are automatically replaced

## File Structure

```
scripts/
├── markdown-formatter.ts      # Core markdown generation logic
├── pr-comment-manager.ts     # GitHub API integration for comments
└── index.ts                  # Exports for other modules

actions/taskmaster-generate/src/
└── main.ts                   # Integration with workflow

test/
├── test-preview-comment-generation.ts  # Unit tests
├── test-integration-pr-workflow.ts     # Integration tests
└── test-edge-cases-preview.ts         # Edge case validation

demo/
└── pr-comment-generation-demo.ts      # Demonstration script
```

## API Reference

### MarkdownFormatter

```typescript
interface TaskGraph {
  tasks: Task[];
  metadata?: {
    totalTasks?: number;
    leafTasks?: number;
    hierarchyDepth?: number;
    generationTimestamp?: string;
    complexityThreshold?: number;
    maxDepth?: number;
  };
}

interface MarkdownFormatterOptions {
  includeDetails?: boolean;
  includeTestStrategy?: boolean;
  maxDisplayDepth?: number;
  showComplexity?: boolean;
  showBlockedStatus?: boolean;
  useCollapsibleSections?: boolean;
  includeSummary?: boolean;
}

// Generate full markdown preview
function formatTaskGraphMarkdown(
  taskGraph: TaskGraph, 
  options?: MarkdownFormatterOptions
): string

// Generate compact summary
function formatCompactTaskGraphSummary(taskGraph: TaskGraph): string
```

### PrCommentManager

```typescript
interface PrCommentConfig {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  debug?: boolean;
}

class PrCommentManager {
  // Post or update task graph preview
  async postTaskGraphPreview(
    taskGraph: TaskGraph, 
    options?: MarkdownFormatterOptions
  ): Promise<{ commentId: number; isNew: boolean }>
  
  // Post compact summary
  async postCompactSummary(taskGraph: TaskGraph): Promise<{ commentId: number; isNew: boolean }>
  
  // Check if PR has PRD changes
  async hasPrdChanges(): Promise<boolean>
  
  // Remove existing preview comments
  async removePreviewComments(): Promise<number>
}

// Helper function for easy integration
async function postTaskGraphPreview(
  taskGraph: TaskGraph,
  config: PrCommentConfig,
  options?: MarkdownFormatterOptions
): Promise<{ commentId: number; isNew: boolean }>
```

## Example Output

### Full Preview (Small Task Graph)
```markdown
# 🚀 Task Graph Preview

## 📊 Task Graph Summary
**Progress:** 1/5 tasks completed (20%)

**Task Status:**
- ✅ Completed: 1
- 🟢 Ready: 2  
- 🚫 Blocked: 2
- 📄 Total: 5

## 📋 Task Hierarchy
- **Task 1**: Setup Repository Structure
  Complexity: 🟡 6/10 | Status: 🟢 Ready | Priority: ⚠️ High
  *Initialize the GitHub Action template repository...*
  
  <details>
  <summary>📂 Subtasks (2)</summary>
  
    - **Task 1**: Create directory structure
      Complexity: 🟢 3/10 | Status: 🟢 Ready
    - **Task 2**: Setup action.yml metadata
      Complexity: 🟢 4/10 | Status: 🚫 Blocked
  </details>
```

### Compact Summary (Large Task Graph)
```markdown
## 🚀 Task Graph Preview
**Task Graph:** 20 tasks (25% complete) | 11 ready, 4 blocked | Depth: 3 levels

<details>
<summary>📋 Click to see full task breakdown</summary>
[Full markdown content here...]
</details>
```

## Testing

Run the comprehensive test suite:

```bash
# Unit tests for markdown formatting
npm run test:preview-comment-generation

# Integration tests with real data
npm run test:integration-pr-workflow

# Edge case validation
npm run test:edge-cases-preview

# Interactive demo
npm run demo:pr-comment-generation
```

## Configuration

The feature uses these environment variables:

- `GITHUB_TOKEN`: Required for posting PR comments
- `GITHUB_PR_NUMBER`: PR number (automatically set by GitHub Actions)
- `DEBUG`: Enable debug logging
- `TASKMASTER_DRY_RUN`: Enable dry-run mode (automatically set for PR events)

## Error Handling

The implementation includes robust error handling:

- **Graceful Degradation**: Workflow continues if comment posting fails
- **Rate Limiting**: Respects GitHub API rate limits
- **Network Issues**: Retries with exponential backoff
- **Invalid Data**: Handles malformed task graphs gracefully
- **Permission Issues**: Logs warnings without failing the workflow

## Best Practices

1. **Performance**: Large task graphs (>15 tasks) use compact format
2. **UX**: Collapsible sections prevent overwhelming reviewers
3. **Maintenance**: Only one preview comment per PR (automatic replacement)
4. **Relevance**: Only posts when PRD files are actually changed
5. **Debugging**: Comprehensive logging for troubleshooting

## Future Enhancements

Potential improvements for future versions:

- **Interactive Elements**: Links to generated issues
- **Diff Highlighting**: Show changes from previous versions
- **Custom Templates**: Configurable markdown templates
- **Notification Settings**: Configurable comment triggers
- **Analytics**: Track preview comment engagement

## Dependencies

This feature builds on:

- **Issue #261**: Dry-Run Mode Implementation (dependency satisfied)
- **GitHub API Integration**: Uses existing enhanced GitHub client
- **Task Graph Parsing**: Leverages existing parsing utilities
- **Workflow Infrastructure**: Integrates with existing action framework