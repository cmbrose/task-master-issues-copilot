# Metadata Management System and Artifact Recovery

This document describes the metadata management system and artifact recovery workflow implemented for the Taskmaster GitHub Actions.

## Overview

The metadata management system provides:
- Enhanced artifact metadata schema for comprehensive task graph indexing
- Artifact search and validation utilities
- Idempotent issue recreation from artifacts via the `taskgraph-replay.yml` workflow
- Structured logging throughout the recovery process

## Enhanced Metadata Schema

The `TaskGraphArtifact` interface has been extended to include:

### Required Fields

- **PRD Hash**: Cryptographic hash of the source PRD content for integrity validation
- **Task Counts**: Categorized counts of tasks by status (total, completed, pending, blocked)
- **Dependency Chains**: Mapping of task dependencies and dependents
- **Workflow Run Context**: Complete context of the workflow run that created the artifact

### Metadata Structure

```typescript
interface TaskGraphArtifact {
  id: string;
  taskGraph: any;
  metadata: {
    // Basic metadata
    createdAt: Date;
    sourcePath?: string;
    totalTasks: number;
    maxDepth: number;
    leafTasks: number;
    processingConfig?: any;
    
    // Enhanced metadata (new)
    prdHash: string;
    taskCounts: {
      total: number;
      completed: number;
      pending: number;
      blocked: number;
    };
    dependencyChains: {
      dependencies: Record<string, string[]>;
      dependents: Record<string, string[]>;
    };
    workflowRunContext: {
      runId: string;
      runNumber: number;
      workflowName: string;
      eventName: string;
      actor: string;
      repository: {
        owner: string;
        name: string;
      };
      ref: string;
      sha: string;
    };
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: ProcessingCheckpoint;
}
```

## Artifact Recovery Workflow

### Triggering the Workflow

The `taskgraph-replay.yml` workflow can be triggered manually via GitHub Actions UI:

1. Navigate to the **Actions** tab in your repository
2. Select **Task Graph Replay** workflow
3. Click **Run workflow**
4. Provide the required inputs:
   - **Artifact ID**: Numeric ID of the artifact to recover from
   - **Dry Run** (optional): Analyze only, don't create issues
   - **Force Recreate** (optional): Recreate even if issues exist
   - **Max Issues** (optional): Limit number of issues to create (1-100)

### Workflow Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `artifact-id` | string | Yes | - | Artifact ID or URL to recover from |
| `dry-run` | boolean | No | false | Analyze only, do not create issues |
| `force-recreate` | boolean | No | false | Force recreation even if issues exist |
| `max-issues` | string | No | '50' | Maximum number of issues to create (1-100) |
| `complexity-threshold` | string | No | '40' | Complexity threshold for task validation (1-100) |

### Workflow Outputs

The workflow provides detailed outputs including:
- Success status
- Number of issues created, updated, and skipped
- Error count and details
- Processing time metrics

## Artifact Search and Validation

### Search Utilities

The `ArtifactManager` class provides search capabilities:

```typescript
// Search by multiple criteria
const artifactIds = await artifactManager.searchArtifacts({
  prdHash: 'abc123...',
  workflowRunId: '12345',
  sourcePath: 'docs/feature.prd.md',
  minTotalTasks: 10,
  status: 'completed'
});
```

### Validation Features

- **Structure Validation**: Ensures artifacts contain all required metadata fields
- **Integrity Validation**: Verifies PRD hash matches expected content
- **Format Validation**: Checks task graph structure and dependency chains

### Download and Recovery

```typescript
// Download and validate artifact
const artifact = await artifactManager.downloadArtifact('12345');

if (artifact) {
  console.log(`PRD Hash: ${artifact.metadata.prdHash}`);
  console.log(`Total Tasks: ${artifact.metadata.totalTasks}`);
  console.log(`Dependencies: ${Object.keys(artifact.metadata.dependencyChains.dependencies).length}`);
}
```

## Issue Recreation Process

### Idempotent Recreation

The recovery process ensures idempotent issue creation:

1. **Download Artifact**: Fetch and validate the specified artifact
2. **Check Existing Issues**: Search for issues that might already exist
3. **Process Task Graph**: Recursively create issues from task hierarchy
4. **Link Relationships**: Establish parent-child relationships between issues
5. **Generate Report**: Provide detailed summary of the recovery process

### Issue Linking

Issues are linked using:
- **Parent References**: Child issues reference their parent in the body
- **Subtask Comments**: Parent issues are updated with subtask references
- **Labels**: Consistent labeling for tracking (`taskmaster`, `recovered`)

### Conflict Resolution

When existing issues are found:
- **Default Behavior**: Skip creation of duplicate issues
- **Force Mode**: Recreate issues even if they exist (use with caution)
- **Dry Run Mode**: Analyze what would be created without making changes

## Structured Logging

### Log Levels and Categories

- **Info**: Normal operation status and progress
- **Warning**: Non-critical issues that don't prevent operation
- **Error**: Critical failures that prevent completion

### Log Format

```
🚀 Starting artifact recovery for ID: 12345
📦 Step 1: Downloading artifact...
✅ Artifact downloaded successfully
   - Total tasks: 15
   - PRD hash: abc123def456
   - Original workflow: Taskmaster Generate
🔍 Step 2: Checking for existing issues...
   - Found 3 existing issues
⚙️ Step 3: Processing task graph...
✅ Created issue #123: Implement user authentication
🔗 Linking issue #124 to parent #123
📊 Recovery Summary:
   - Success: true
   - Issues created: 12
   - Issues updated: 0
   - Issues skipped: 3
   - Errors: 0
   - Processing time: 45.23s
```

## Error Handling and Recovery

### Common Error Scenarios

1. **Invalid Artifact ID**: Numeric validation and clear error messages
2. **Download Failures**: Retry logic with exponential backoff
3. **Malformed Data**: Graceful degradation with detailed validation errors
4. **API Rate Limits**: Automatic throttling and retry mechanisms
5. **Permission Errors**: Clear guidance on required permissions

### Recovery Strategies

- **Partial Success**: Continue processing even if some issues fail to create
- **Checkpoint System**: Save progress to enable resumption of failed operations
- **Rollback Capability**: Option to reverse changes if recovery fails
- **Dry Run Testing**: Validate recovery process before making actual changes

## Best Practices

### For Repository Maintainers

1. **Regular Artifact Cleanup**: Use retention policies to manage artifact storage
2. **Test Recovery Process**: Periodically test artifact recovery in dry-run mode
3. **Monitor Workflow Runs**: Check recovery logs for errors or performance issues
4. **Backup Critical Artifacts**: Preserve important task graph artifacts

### For Users

1. **Use Dry Run First**: Always test artifact recovery with dry-run mode
2. **Check Existing Issues**: Review what issues already exist before recovery
3. **Limit Issue Creation**: Use `max-issues` parameter for large task graphs
4. **Review Recovery Report**: Check the summary for any issues or errors

## Troubleshooting

### Common Issues

#### Invalid Artifact ID
```
❌ Invalid artifact ID format: abc123. Expected numeric ID.
```
**Solution**: Ensure you're using the numeric artifact ID from GitHub Actions

#### Permission Errors
```
❌ Resource not accessible by integration
```
**Solution**: Verify the workflow has `issues: write` permission

#### Artifact Not Found
```
❌ Failed to download artifact 12345: Artifact not found
```
**Solution**: Check the artifact ID and ensure it hasn't been cleaned up

#### Rate Limiting
```
⚠️ GitHub API rate limit encountered, retrying in 60 seconds...
```
**Solution**: The system handles this automatically, but consider reducing `max-issues`

### Debug Mode

Enable verbose logging by checking the workflow run logs in the GitHub Actions interface.

## Security Considerations

- Artifact recovery requires `issues: write` permission
- PRD hashes provide integrity validation but are not cryptographically secure
- Sensitive information in task graphs should be reviewed before recovery
- Recovery process should be tested in dry-run mode before production use

## Performance Characteristics

- **Small Task Graphs** (< 20 tasks): Recovery completes in under 30 seconds
- **Medium Task Graphs** (20-100 tasks): Recovery completes in 1-3 minutes
- **Large Task Graphs** (100+ tasks): Use `max-issues` parameter to limit processing
- **Rate Limiting**: Automatic handling with exponential backoff for API limits