# Cron Scheduling Implementation

This document describes the implementation of the automated cron scheduling system for dependency resolution in the Taskmaster project.

## Overview

The cron scheduling implementation provides automated scanning for closed issues and automatic removal of 'blocked' labels from dependent tasks. This ensures that task dependencies are resolved promptly without manual intervention.

## Implementation

### Workflow File

**Location**: `.github/workflows/dependency-resolver.yml`

The dedicated workflow runs every 10 minutes to scan for closed issues and update dependent task labels accordingly.

### Key Features

1. **Scheduled Execution**: Runs every 10 minutes (`*/10 * * * *`)
2. **Full Scan Mode**: Scans all open issues for dependency resolution
3. **Automatic Label Management**: Removes 'blocked' labels and adds 'ready' labels as appropriate
4. **Comprehensive Error Handling**: Built-in retry logic and graceful degradation
5. **Rate Limiting**: Sophisticated rate limiting to respect GitHub API limits
6. **Detailed Reporting**: Provides summary of issues updated and dependencies resolved

### Workflow Structure

```yaml
name: Dependency Resolver - Cron Scheduling

on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes

permissions:
  issues: write
  contents: read

jobs:
  dependency-resolver:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
      - name: Log Scheduled Run
      - name: Run Taskmaster Watcher (Full Scan Mode)
      - name: Report Results
      - name: Summary
```

## Error Handling & Rate Limiting

The implementation includes comprehensive error handling and rate limiting through the Enhanced GitHub API client:

### Rate Limiting Features
- **Exponential Backoff**: Different retry strategies for different error types
- **Rate Limit Detection**: Automatic detection and handling of GitHub rate limits
- **Retry-After Headers**: Respects GitHub's retry-after headers
- **Circuit Breaker**: Prevents cascade failures during API issues
- **Concurrent Request Management**: Limits concurrent requests to avoid overwhelming the API

### Error Categories
- **Rate Limited**: Aggressive exponential backoff (max 1 minute)
- **Network Issues**: Faster retry with 1.5x multiplier (max 10 seconds)
- **Server Errors**: Standard backoff (max 30 seconds)
- **Timeout**: Short delays with 1.2x multiplier (max 5 seconds)

### Graceful Degradation
- Automatic fallback strategies for non-critical operations
- Detailed error reporting without failing the entire workflow
- Continuation of processing even when individual issues fail

## Dependency Resolution Logic

### Label Management
The system automatically manages the following labels:

- **`blocked`**: Applied when an issue has open dependencies
- **`blocked-by:N`**: Shows the number of blocking dependencies
- **`ready`**: Applied when all dependencies are resolved

### Processing Flow
1. **Scan Phase**: Get all open issues with 'taskmaster' label
2. **Parse Phase**: Parse issue bodies to extract dependency information
3. **Evaluate Phase**: Check dependency status against current issue state
4. **Update Phase**: Update labels only when changes are needed
5. **Report Phase**: Log results and generate summary

### Dependency Detection
The system parses issue bodies looking for dependency sections in this format:

```markdown
## Dependencies

- [ ] #123  <!-- Open dependency -->
- [x] #456  <!-- Closed dependency -->
```

## Testing

### Test Coverage
The implementation includes comprehensive tests:

**Test File**: `test/test-cron-scheduling.sh`

**Test Categories**:
- ✅ Workflow file existence and YAML syntax validation
- ✅ Cron schedule configuration (every 10 minutes)
- ✅ Permissions configuration (issues: write, contents: read)
- ✅ Taskmaster watcher integration with full scan mode
- ✅ GitHub token configuration
- ✅ Output capture for reporting
- ✅ Error handling and proper action versions
- ✅ Workflow identification and purpose

### Running Tests
```bash
# Run cron scheduling tests specifically
npm run test:cron-scheduling

# Run all tests including cron scheduling
npm run test:all
```

## Configuration

### Timing
- **Primary Schedule**: Every 10 minutes (`*/10 * * * *`)
- **Scope**: All open issues with 'taskmaster' label
- **Mode**: Full scan (not just webhook-triggered issues)

### Permissions Required
- **issues: write** - To update issue labels
- **contents: read** - To checkout repository and access configuration

### Environment Variables
- **GITHUB_TOKEN**: Automatically provided by GitHub Actions
- **Repository Context**: Automatically detected from workflow context

## Monitoring & Observability

### Workflow Outputs
- **Issues Updated**: Number of issues that had their labels updated
- **Dependencies Resolved**: Number of dependency chains that were resolved

### Logging
- Detailed step-by-step logging of the resolution process
- Error reporting with specific issue numbers and error messages
- Summary reporting in GitHub Actions summary view

### Metrics
The Enhanced GitHub API client tracks:
- Total API requests
- Error rates by category
- Retry attempts
- Rate limit hits
- Circuit breaker activations

## Integration with Existing System

### Relationship to Main Workflow
The cron scheduling implementation complements the existing `taskmaster.yml` workflow:

- **Main Workflow**: Handles multiple triggers (manual, push, PR, issue events) with comprehensive features
- **Dependency Resolver**: Focused solely on scheduled dependency resolution

### Shared Components
Both workflows use the same underlying components:
- `actions/taskmaster-watcher` action
- Enhanced GitHub API client with rate limiting
- Issue parsing and dependency resolution logic
- Error handling and reporting mechanisms

## Future Enhancements

### Potential Improvements
1. **Dynamic Scheduling**: Adjust frequency based on repository activity
2. **Selective Scanning**: Target specific issue types or labels
3. **Batch Processing**: Group updates for efficiency
4. **Advanced Metrics**: More detailed performance and success metrics
5. **Notification System**: Alert on resolution milestones or errors

### Scalability Considerations
- The current implementation scales well for repositories with hundreds of issues
- For larger repositories, consider implementing selective scanning or batching
- Rate limiting ensures the system doesn't overwhelm GitHub's API

## Troubleshooting

### Common Issues
1. **Rate Limiting**: The system handles this automatically with exponential backoff
2. **Permission Errors**: Ensure the workflow has proper `issues: write` permission
3. **Parse Errors**: Individual issue parse failures don't stop the workflow
4. **API Timeouts**: Automatic retry with appropriate delays

### Debug Information
Enable debug logging by modifying the GitHub API client configuration:
```typescript
debug: true  // Enable detailed API logging
```

### Monitoring Workflow Runs
Check the Actions tab in GitHub to monitor:
- Workflow execution frequency
- Success/failure rates
- Issues processed per run
- Dependencies resolved per run

## Conclusion

The cron scheduling implementation provides a robust, automated solution for dependency resolution in the Taskmaster system. With comprehensive error handling, rate limiting, and detailed reporting, it ensures reliable operation while respecting GitHub's API constraints.