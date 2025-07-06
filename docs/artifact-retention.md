# Artifact Retention Policies and Cleanup Automation

This document describes the artifact retention policies and cleanup automation features implemented for the Taskmaster GitHub Actions.

## Overview

The artifact retention system provides automated cleanup of old artifacts while preserving important data based on configurable policies:

- **Age-based retention**: Remove artifacts older than a specified number of days
- **Count-based retention**: Keep only the most recent N artifacts
- **Success preservation**: Optionally preserve artifacts from successful workflow runs
- **Pattern-based cleanup**: Target specific artifact names using pattern matching

## Configuration

### Retention Policy Inputs

The following inputs are available for configuring retention policies:

#### `max-artifacts-count`
- **Description**: Maximum number of artifacts to keep (older ones will be cleaned up)
- **Default**: `10`
- **Range**: 1-100
- **Example**: `15`

#### `retention-days`
- **Description**: Number of days to keep artifacts before cleanup
- **Default**: `30`
- **Range**: 1-365
- **Example**: `45`

### Configuration Methods

#### 1. Workflow Dispatch Inputs
```yaml
# Manual workflow dispatch
workflow_dispatch:
  inputs:
    max-artifacts-count:
      description: 'Maximum number of artifacts to keep'
      default: '10'
    retention-days:
      description: 'Number of days to keep artifacts'
      default: '30'
```

#### 2. Configuration Files
```yaml
# .taskmaster.yml
taskmaster:
  max-artifacts-count: 15
  retention-days: 45
```

#### 3. Environment Variables
```bash
export TM_MAX_ARTIFACTS_COUNT=15
export TM_RETENTION_DAYS=45
```

## Artifact Cleanup Action

### Usage

The `actions/artifact-cleanup` action provides automated cleanup functionality:

```yaml
- name: Clean Up Artifacts
  uses: ./actions/artifact-cleanup
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    max-artifacts-count: '10'
    retention-days: '30'
    dry-run: false
    preserve-successful-runs: true
    artifact-name-pattern: 'task-graph*'
```

### Inputs

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `github-token` | GitHub token for API access | - | ✅ |
| `max-artifacts-count` | Maximum artifacts to keep | `10` | ❌ |
| `retention-days` | Days to keep artifacts | `30` | ❌ |
| `dry-run` | Run without deleting (simulation mode) | `false` | ❌ |
| `preserve-successful-runs` | Preserve artifacts from successful runs | `true` | ❌ |
| `artifact-name-pattern` | Pattern to match artifact names | `task-graph*` | ❌ |

### Outputs

| Output | Description |
|--------|-------------|
| `artifacts-deleted` | Number of artifacts deleted |
| `artifacts-preserved` | Number of artifacts preserved |
| `cleanup-summary` | JSON summary of cleanup actions |
| `dry-run-mode` | Whether cleanup ran in dry-run mode |

## Scheduled Cleanup Workflow

The system includes an automated cleanup workflow that runs daily:

### Schedule
- **Frequency**: Daily at 2:00 AM UTC
- **Cron Expression**: `0 2 * * *`

### Manual Trigger
The cleanup can also be triggered manually via workflow dispatch with custom parameters.

### Workflow Location
`.github/workflows/artifact-cleanup.yml`

## Retention Policies

### Policy Application Order

1. **Age-based retention**: Artifacts older than `retention-days` are marked for deletion
2. **Count-based retention**: Keep only the most recent `max-artifacts-count` artifacts
3. **Success preservation**: If `preserve-successful-runs` is true, preserve artifacts from successful workflow runs

### Preservation Logic

Artifacts are preserved if they meet any of these criteria:

- **Within retention period**: Age is less than `retention-days`
- **Recent artifacts**: Among the most recent `max-artifacts-count` artifacts
- **Successful runs**: From workflows that concluded successfully (when `preserve-successful-runs` is enabled)

### Pattern Matching

The `artifact-name-pattern` input supports basic wildcard patterns:
- `*` matches any number of characters
- `?` matches any single character
- Examples:
  - `task-graph*` matches `task-graph-123`, `task-graph-run-456`
  - `*-report` matches `test-report`, `build-report`
  - `artifact-??.zip` matches `artifact-01.zip`, `artifact-99.zip`

## Enhanced Metadata Tracking

Artifacts now include enhanced metadata for better tracking:

### Metadata Fields

- `retention_days`: Configured retention period
- `max_artifacts_count`: Configured maximum artifact count
- `generation_timestamp`: When the artifact was created
- `prd_version`: Version of the PRD file processed
- `total_tasks`: Number of tasks in the task graph
- `file_size_mb`: Artifact size in megabytes

### Metadata Access

Metadata is available as action outputs with the `metadata-` prefix:
- `metadata-retention-days`
- `metadata-max-artifacts-count`
- `metadata-generation-timestamp`
- etc.

## Examples

### Basic Usage in Taskmaster Generate

```yaml
- name: Run Taskmaster Generate
  uses: ./actions/taskmaster-generate
  with:
    prd-path-glob: 'docs/**.prd.md'
    max-artifacts-count: '15'
    retention-days: '60'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Custom Cleanup Schedule

```yaml
name: Weekly Artifact Cleanup
on:
  schedule:
    - cron: '0 3 * * 0'  # Sunday 3 AM UTC

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./actions/artifact-cleanup
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          max-artifacts-count: '5'
          retention-days: '14'
          preserve-successful-runs: false
```

### Dry-Run Testing

```yaml
- name: Test Cleanup (Dry Run)
  uses: ./actions/artifact-cleanup
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    dry-run: true
    max-artifacts-count: '3'
    retention-days: '7'
```

## Best Practices

### 1. Start with Dry-Run
Always test retention policies with `dry-run: true` before applying them.

### 2. Gradual Retention Reduction
If reducing retention periods, do so gradually to avoid unexpected data loss.

### 3. Preserve Important Runs
Enable `preserve-successful-runs` for production environments to maintain artifacts from successful deployments.

### 4. Monitor Cleanup Results
Review cleanup summaries and logs to ensure policies are working as expected.

### 5. Environment-Specific Policies
Use different retention policies for different environments:
- Development: Aggressive cleanup (5 artifacts, 14 days)
- Staging: Moderate cleanup (10 artifacts, 30 days)  
- Production: Conservative cleanup (25 artifacts, 90 days)

## Troubleshooting

### Common Issues

#### 1. Insufficient Permissions
**Error**: `Resource not accessible by integration`
**Solution**: Ensure the workflow has `actions: write` permission.

#### 2. No Artifacts Found
**Error**: `No artifacts found matching the criteria`
**Solution**: Check the `artifact-name-pattern` and verify artifacts exist.

#### 3. Validation Errors
**Error**: `Max artifacts count must be a number between 1 and 100`
**Solution**: Verify input values are within valid ranges.

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## Migration

If you're upgrading from hardcoded retention settings:

1. **Review Current Settings**: The previous default was 30 days retention
2. **Update Workflows**: Add the new retention inputs to existing workflows
3. **Test Configuration**: Use dry-run mode to test new policies
4. **Monitor Results**: Check cleanup logs after deployment

## Security Considerations

- The cleanup action requires `actions: write` permission
- GitHub tokens used for cleanup should have appropriate repository access
- Dry-run mode is recommended for testing in production environments
- Preserve artifacts from security-related workflows when possible