# Task Master Issues

A GitHub Action template for automated task planning and issue management based on Product Requirements Documents (PRDs).

## Overview

This repository provides GitHub Actions that automatically generate hierarchical task graphs from PRD files, create corresponding GitHub issues, and manage dependencies between tasks.

**Key Features:**
- 🚀 **Automated Issue Generation**: Convert PRD files into structured GitHub issues
- 🔗 **Dependency Management**: Automatic blocking/unblocking based on issue relationships  
- 📊 **Hierarchical Task Breakdown**: Recursive decomposition of complex tasks
- ⚡ **On-Demand Breakdown**: Manual task decomposition via `/breakdown` commands
- 🎯 **Configurable Complexity**: Customizable thresholds for task sizing
- 📈 **Artifact Generation**: Persistent task graphs for analysis and replay

**Workflow Integration:**
- Triggers on PRD file changes (push events)
- Responds to issue comments for manual breakdown
- Monitors issue status changes for dependency updates
- Supports both webhook and scheduled scanning modes

## Directory Structure

```
├── actions/                    # GitHub Actions implementations
│   ├── taskmaster-generate/   # Generate issues from PRDs
│   ├── taskmaster-breakdown/  # Break down issues via commands
│   └── taskmaster-watcher/    # Watch and update dependencies
├── scripts/                   # Shared utility scripts
├── docs/                      # Documentation and PRD files
├── .github/                   # GitHub workflows and configuration
└── .taskmaster/              # Taskmaster CLI configuration
```

## Actions

### 🚀 taskmaster-generate
- **Purpose**: Automatically generate GitHub issues from PRD files
- **Trigger**: Push events to PRD files (configurable glob pattern)
- **Features**: Hierarchical issue creation, dependency linking, artifact generation

### 🔄 taskmaster-breakdown  
- **Purpose**: Break down large issues into manageable sub-tasks
- **Trigger**: Issue comments with `/breakdown` command
- **Features**: On-demand decomposition, configurable depth and thresholds

### 👁️ taskmaster-watcher
- **Purpose**: Monitor dependencies and update issue status
- **Trigger**: Issue closed events and scheduled cron jobs
- **Features**: Automatic label management, dependency chain resolution

## Quick Start

1. **Add actions to your workflow file** (`.github/workflows/`):
   ```yaml
   name: Taskmaster Workflow
   on:
     push:
       paths: ['docs/**.prd.md']
     issue_comment:
       types: [created]
     issues:
       types: [closed]

   jobs:
     generate-tasks:
       if: github.event_name == 'push'
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: your-org/task-master-issues/actions/taskmaster-generate@v1
           with:
             github-token: ${{ secrets.GITHUB_TOKEN }}
   ```

2. **Create a PRD file** in `docs/` directory ending with `.prd.md`

3. **Push to trigger** automatic issue generation from your PRD

## Usage Examples

### 🚀 Generate Issues from PRD Files

Automatically create GitHub issues when PRD files are modified:

```yaml
name: Generate Tasks
on:
  push:
    paths: ['docs/**.prd.md']

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Generate Issues from PRD
        uses: ./actions/taskmaster-generate
        with:
          complexity-threshold: '40'
          max-depth: '3'
          prd-path-glob: 'docs/**.prd.md'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs:**
- `complexity-threshold` (optional, default: `40`): Maximum complexity for task breakdown
- `max-depth` (optional, default: `3`): Maximum recursion depth for task hierarchy
- `prd-path-glob` (optional, default: `docs/**.prd.md`): Glob pattern for PRD files
- `taskmaster-args` (optional): Additional CLI arguments for Taskmaster
- `github-token` (required): GitHub token with Issues write permissions

**Outputs:**
- `task-graph`: Path to generated task graph JSON file
- `issues-created`: Number of issues created or updated

### 🔄 Break Down Issues On-Demand

Allow users to decompose large issues using `/breakdown` comments:

```yaml
name: Issue Breakdown
on:
  issue_comment:
    types: [created]

jobs:
  breakdown:
    if: startsWith(github.event.comment.body, '/breakdown')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Break Down Issue
        uses: ./actions/taskmaster-breakdown
        with:
          breakdown-max-depth: '2'
          complexity-threshold: '40'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs:**
- `breakdown-max-depth` (optional, default: `2`): Maximum depth for breakdown recursion
- `complexity-threshold` (optional, default: `40`): Complexity threshold for decomposition
- `taskmaster-args` (optional): Additional CLI arguments for Taskmaster
- `github-token` (required): GitHub token with Issues write permissions

**Outputs:**
- `sub-issues-created`: Number of sub-issues created
- `parent-issue-updated`: Whether parent issue was updated (true/false)

**Usage in issues:**
```
/breakdown --depth 1 --threshold 30
```

### 👁️ Monitor Dependencies and Update Status

Automatically update blocked status when dependencies are resolved:

```yaml
name: Dependency Watcher
on:
  issues:
    types: [closed]
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes

jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Update Dependencies
        uses: ./actions/taskmaster-watcher
        with:
          scan-mode: ${{ github.event_name == 'schedule' && 'full' || 'webhook' }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs:**
- `github-token` (required): GitHub token with Issues write permissions
- `scan-mode` (optional, default: `webhook`): Scan mode - `webhook` for single issue, `full` for all issues

**Outputs:**
- `issues-updated`: Number of issues with updated blocked status  
- `dependencies-resolved`: Number of dependency chains resolved

## Configuration

### Environment Variables

The actions can be configured through inputs or environment variables:

```yaml
env:
  INPUT_COMPLEXITY_THRESHOLD: '50'
  INPUT_MAX_DEPTH: '2'
  INPUT_PRD_PATH_GLOB: 'docs/requirements/**.prd.md'
```

### Default Settings

| Setting | Default Value | Description |
|---------|---------------|-------------|
| `complexity-threshold` | `40` | Tasks above this complexity are broken down |
| `max-depth` | `3` | Maximum levels of task hierarchy |
| `breakdown-max-depth` | `2` | Additional breakdown depth for `/breakdown` |
| `prd-path-glob` | `docs/**.prd.md` | Pattern for PRD files |
| `scan-mode` | `webhook` | Watcher scan mode |

### GitHub Token Permissions

The `github-token` requires the following permissions:
- `issues:write` - Create and update issues
- `contents:read` - Read repository contents
- `metadata:read` - Access repository metadata

## Complete Workflow Example

Here's a comprehensive workflow that uses all three actions:

```yaml
name: Taskmaster Complete Workflow

on:
  push:
    paths: ['docs/**.prd.md']
  issue_comment:
    types: [created]
  issues:
    types: [closed]
  schedule:
    - cron: '*/10 * * * *'

jobs:
  generate-from-prd:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Generate Issues
        id: generate
        uses: ./actions/taskmaster-generate
        with:
          complexity-threshold: '40'
          max-depth: '3'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Upload Task Graph
        uses: actions/upload-artifact@v4
        with:
          name: task-graph
          path: ${{ steps.generate.outputs.task-graph }}

  breakdown-on-command:
    if: github.event_name == 'issue_comment' && startsWith(github.event.comment.body, '/breakdown')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Break Down Issue
        uses: ./actions/taskmaster-breakdown
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

  watch-dependencies:
    if: github.event_name == 'issues' || github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Update Dependencies
        uses: ./actions/taskmaster-watcher
        with:
          scan-mode: ${{ github.event_name == 'schedule' && 'full' || 'webhook' }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Development

This project uses TypeScript for action development. Each action is independently buildable and deployable.

### Building Actions

```bash
# Build all actions
npm run build:actions

# Build individual actions  
npm run build:generate
npm run build:breakdown
npm run build:watcher
```

### Testing Actions

```bash
# Run action tests
npm test

# Test specific action
npm run test:generate
```

## Troubleshooting

### Common Issues

**Issue**: Action fails with "No PRD files found"
- **Solution**: Ensure PRD files match the `prd-path-glob` pattern and end with `.prd.md`

**Issue**: "GitHub token insufficient permissions"  
- **Solution**: Verify token has `issues:write` and `contents:read` permissions

**Issue**: Issues not being updated when dependencies close
- **Solution**: Check that the watcher workflow is configured with proper triggers

**Issue**: `/breakdown` command not responding
- **Solution**: Ensure issue comment workflow is triggered on `issue_comment.created` events

### Debugging

Enable debug logging by setting:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

### Rate Limiting

If you hit GitHub API rate limits:
1. Use scheduled workflows instead of event-driven for large repositories
2. Adjust `max-depth` and `complexity-threshold` to reduce API calls
3. Consider using a GitHub App token for higher rate limits

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/cmbrose/task-master-issues/issues) page.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and ensure tests pass
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Built with ❤️ for streamlined task management and issue tracking.*