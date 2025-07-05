# Trigger Configuration Guide

This document explains the comprehensive trigger configuration for the Taskmaster GitHub Actions workflow.

## Overview

The Taskmaster workflow (`taskmaster.yml`) supports multiple trigger types with automatic mode detection and input validation. The workflow adapts its behavior based on how it was triggered.

## Trigger Types

### 1. Manual Dispatch (`workflow_dispatch`)

Allows manual execution with customizable parameters:

```yaml
workflow_dispatch:
  inputs:
    complexity-threshold:
      description: 'Maximum complexity threshold for task breakdown (1-100)'
      required: false
      default: '40'
      type: string
    # ... other inputs
```

**Features:**
- Comprehensive input validation
- Choice-based dropdowns for modes
- Boolean toggles for flags
- Default values for all parameters

**Usage:**
1. Navigate to Actions tab in GitHub
2. Select "Taskmaster Complete Workflow"
3. Click "Run workflow"
4. Customize parameters as needed

### 2. PRD File Changes (`push`)

Automatically triggers when PRD files are modified on main branches:

```yaml
push:
  paths:
    - 'docs/**.prd.md'
    - 'docs/**/*.prd.md'
  branches:
    - main
    - master
```

**Behavior:**
- Mode: `generate`
- Scan: `webhook`
- Dry-run: `false`
- Processes changed PRD files to create/update issues

### 3. Pull Request Changes (`pull_request`)

Triggers on pull requests that modify PRD files for preview/analysis:

```yaml
pull_request:
  paths:
    - 'docs/**.prd.md'
    - 'docs/**/*.prd.md'
  types: [opened, synchronize, reopened]
```

**Behavior:**
- Mode: `generate`
- Scan: `webhook`
- Dry-run: `true`
- Analyzes PRD changes without creating issues
- Provides preview of what would be created

### 4. Issue Comments (`issue_comment`)

Responds to `/breakdown` commands in issue comments:

```yaml
issue_comment:
  types: [created]
```

**Features:**
- Filters comments starting with `/breakdown`
- Reacts with 👍/👎 based on success
- Mode: `breakdown`
- Scan: `webhook`

**Usage:**
Comment on any issue with:
```
/breakdown max-depth=3 complexity=30
```

### 5. Issue State Changes (`issues`)

Tracks issue closures for dependency management:

```yaml
issues:
  types: [closed, reopened]
```

**Behavior:**
- Mode: `watcher`
- Scan: `webhook`
- Updates blocked status of dependent issues

### 6. Scheduled Runs (`schedule`)

Periodic dependency checking:

```yaml
schedule:
  # Every 10 minutes during business hours (9 AM - 6 PM UTC, Mon-Fri)
  - cron: '*/10 9-18 * * 1-5'
  # Hourly during off-hours and weekends
  - cron: '0 * * * *'
```

**Behavior:**
- Mode: `watcher`
- Scan: `full`
- Comprehensive dependency resolution

## Input Validation

The workflow includes comprehensive input validation for manual dispatch:

### Validation Rules

| Parameter | Type | Range | Validation |
|-----------|------|-------|------------|
| `complexity-threshold` | number | 1-100 | Numeric range check |
| `max-depth` | number | 1-10 | Numeric range check |
| `breakdown-max-depth` | number | 1-5 | Numeric range check |
| `prd-path-glob` | string | - | Must end with `.prd.md` |
| `taskmaster-version` | string | - | Semver format (x.y.z) |
| `action-mode` | choice | - | Predefined options |
| `scan-mode` | choice | - | Predefined options |
| `force-download` | boolean | - | Boolean conversion |

### Error Handling

Invalid inputs result in:
- Clear error messages
- Workflow failure before execution
- Detailed validation feedback

Example error:
```
❌ Invalid complexity-threshold: 150. Must be between 1 and 100.
```

## Mode Detection

The workflow automatically determines the appropriate action mode:

| Trigger | Mode | Scan Mode | Dry-run | Purpose |
|---------|------|-----------|---------|---------|
| `workflow_dispatch` | User choice | User choice | `false` | Manual execution |
| `push` | `generate` | `webhook` | `false` | PRD processing |
| `pull_request` | `generate` | `webhook` | `true` | PRD preview/analysis |
| `issue_comment` | `breakdown` | `webhook` | `false` | Issue breakdown |
| `issues` | `watcher` | `webhook` | `false` | Dependency tracking |
| `schedule` | `watcher` | `full` | `false` | Periodic checks |

## Configuration Examples

### Basic Setup

```yaml
# .github/workflows/taskmaster.yml
name: Taskmaster Complete Workflow

on:
  workflow_dispatch:
  push:
    paths: ['docs/**.prd.md']
  issue_comment:
    types: [created]
  issues:
    types: [closed, reopened]
  schedule:
    - cron: '*/10 * * * *'

jobs:
  taskmaster:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cmbrose/task-master-issues@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Custom Configuration

```yaml
- uses: cmbrose/task-master-issues@v1
  with:
    complexity-threshold: '50'
    max-depth: '4'
    prd-path-glob: 'requirements/**.prd.md'
    breakdown-max-depth: '3'
    taskmaster-version: '1.2.0'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Environment-Specific

```yaml
- uses: cmbrose/task-master-issues@v1
  with:
    complexity-threshold: ${{ github.ref == 'refs/heads/main' && '40' || '30' }}
    max-depth: ${{ github.ref == 'refs/heads/main' && '3' || '2' }}
    scan-mode: ${{ github.event_name == 'schedule' && 'full' || 'webhook' }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Security Considerations

### Required Permissions

```yaml
permissions:
  issues: write      # Create and update issues
  contents: read     # Read repository contents
  pull-requests: read # Read PR information
```

### Token Security

- Uses `${{ secrets.GITHUB_TOKEN }}` by default
- Automatically scoped to repository
- No additional permissions required

### Input Sanitization

- All user inputs are validated
- Dangerous characters filtered
- Injection attacks prevented

## Monitoring and Observability

### Workflow Outputs

- Task graph artifacts
- Execution summaries
- Performance metrics
- Error reporting

### Logging

```bash
🚀 Taskmaster triggered by: workflow_dispatch
📋 Action mode: generate
🔍 Scan mode: webhook
👤 Triggered manually by: username
⚙️ Parameters:
  • Complexity threshold: 40
  • Max depth: 3
```

### Artifacts

- Task graphs uploaded with retention
- Build logs and metrics
- Configuration snapshots

## Troubleshooting

### Common Issues

1. **Invalid input parameters**
   - Check validation rules
   - Use default values for testing
   - Review error messages

2. **Missing permissions**
   - Add required permissions block
   - Check token scope
   - Verify repository settings

3. **Trigger not firing**
   - Check file paths for push triggers
   - Verify comment format for issue triggers
   - Review branch restrictions

### Debug Mode

Enable debug logging:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## Best Practices

1. **Use default values** for most parameters
2. **Test manually** before setting up automation
3. **Monitor workflow runs** for performance
4. **Validate inputs** before deployment
5. **Set appropriate schedules** to avoid rate limits
6. **Use artifacts** for debugging and replay

## Migration Guide

### From Basic Setup

If you have an existing basic workflow:

1. Replace trigger configuration with comprehensive setup
2. Add input validation job
3. Update permissions block
4. Test with manual dispatch first

### From Individual Actions

If using individual actions separately:

1. Consolidate into single workflow
2. Add mode detection logic
3. Configure appropriate triggers
4. Update calling workflows