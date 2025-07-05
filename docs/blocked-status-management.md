# Blocked Status Management

This document describes the blocked status management functionality implemented in the `taskmaster-watcher` action.

## Overview

The blocked status management system automatically tracks issue dependencies and updates issue labels when their blocking dependencies are resolved. This ensures that issues are properly marked as "blocked" when they have unresolved dependencies and "ready" when all dependencies are completed.

## How It Works

### Dependency Tracking

The system parses issue bodies looking for a "Dependencies" section with the following format:

```markdown
## Dependencies

- [ ] #123 (open dependency - blocks the issue)
- [x] #456 (closed dependency - resolved)
```

### Label Management

Based on dependency status, the system automatically manages these labels:

- `blocked` - Added when the issue has one or more open dependencies
- `blocked-by:N` - Added to show the number of blocking dependencies (where N is the count)
- `ready` - Added when all dependencies are resolved (replaces blocked labels)

### Operation Modes

#### Webhook Mode (`scan-mode: webhook`)
- Triggered by issue closed events
- Finds issues that depend on the newly closed issue
- Updates only those issues that become unblocked
- More efficient for real-time updates

#### Full Scan Mode (`scan-mode: full`)
- Scans all open issues with the `taskmaster` label
- Updates dependency status for all issues
- Useful for batch updates and scheduled maintenance
- More comprehensive but slower

## Example Workflow

1. **Issue A depends on Issue B and Issue C**
   - Issue A gets labels: `blocked`, `blocked-by:2`

2. **Issue B is closed**
   - System detects Issue A depends on the closed Issue B
   - Issue A still depends on open Issue C
   - Labels remain: `blocked`, `blocked-by:1`

3. **Issue C is closed**
   - System detects Issue A's last dependency is resolved
   - Labels updated to: `ready` (blocked labels removed)

## Configuration

The watcher action accepts these inputs:

- `github-token` (required): GitHub token for API access
- `scan-mode` (optional): Either `webhook` or `full` (default: `webhook`)

## Error Handling

The system includes comprehensive error handling:

- Individual issue parsing failures don't stop the entire process
- API failures are logged with detailed error messages
- Partial successes are reported in action outputs

## Outputs

The action provides these outputs:

- `issues-updated`: Number of issues with updated blocked status
- `dependencies-resolved`: Number of dependency chains resolved

## Testing

Run the blocked status management tests:

```bash
npm run test:blocked-status
```

This validates:
- Dependency label generation logic
- Unblockable issue detection
- Issue body parsing
- Label update behavior
- Edge case handling