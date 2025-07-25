# Task Master Issues

[![CI/CD Pipeline](https://github.com/cmbrose/task-master-issues/actions/workflows/ci-cd-pipeline.yml/badge.svg)](https://github.com/cmbrose/task-master-issues/actions/workflows/ci-cd-pipeline.yml)
[![Security Scanning](https://github.com/cmbrose/task-master-issues/actions/workflows/security-scanning.yml/badge.svg)](https://github.com/cmbrose/task-master-issues/actions/workflows/security-scanning.yml)
[![Release](https://github.com/cmbrose/task-master-issues/actions/workflows/release-deployment.yml/badge.svg)](https://github.com/cmbrose/task-master-issues/actions/workflows/release-deployment.yml)

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

1. **Add the composite action to your workflow file** (`.github/workflows/`):
   ```yaml
   name: Taskmaster Workflow
   on:
     push:
       paths: ['docs/**.prd.md']
     pull_request:
       paths: ['docs/**.prd.md']
     issue_comment:
       types: [created]
     issues:
       types: [closed]

   permissions:
     issues: write
     contents: read
     pull-requests: write

   jobs:
     taskmaster:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: cmbrose/task-master-issues@v1
           with:
             complexity-threshold: '40'
             max-depth: '3'
             prd-path-glob: 'docs/**.prd.md'
             breakdown-max-depth: '2'
             github-token: ${{ secrets.GITHUB_TOKEN }}
   ```

2. **Create a PRD file** in `docs/` directory ending with `.prd.md`

3. **Push to trigger** automatic issue generation from your PRD

## 📚 Complete Documentation

This repository includes comprehensive documentation for all user types:

### 🎯 Quick Access by Role
- **[Contributors](./docs/user-guide.md#1-contributors-developers-designers-qa)**: Finding and completing work
- **[Maintainers](./docs/user-guide.md#2-maintainers-tech-leads-senior-engineers)**: System configuration and monitoring  
- **[Product Managers](./docs/user-guide.md#3-product-managers-pms-product-owners)**: PRD writing and progress tracking
- **[System Operators](./docs/deployment-guide.md)**: Deployment and maintenance

### 📖 Documentation Index
- **[User Guide](./docs/user-guide.md)** - Comprehensive guide for all personas
- **[Deployment Guide](./docs/deployment-guide.md)** - Step-by-step setup instructions
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Developer Guide](./docs/developer-guide.md)** - Development environment and patterns
- **[Architecture Overview](./docs/architecture-overview.md)** - System design and components
- **[Documentation Index](./docs/README.md)** - Complete documentation navigation

### 🚀 Getting Started Paths
- **New to the system?** → [User Guide](./docs/user-guide.md)
- **Setting up for your team?** → [Deployment Guide](./docs/deployment-guide.md)
- **Want to contribute code?** → [Developer Guide](./docs/developer-guide.md)
- **Need API integration?** → [API Reference](./docs/api-reference.md)

## Trigger Configuration

The Taskmaster workflow supports multiple trigger types with automatic mode detection:

### Supported Triggers

- **📝 Manual Dispatch** (`workflow_dispatch`) - Manual execution with parameter validation
- **🚀 PRD Changes** (`push`) - Automatic processing of PRD file changes  
- **💬 Issue Comments** (`issue_comment`) - `/breakdown` command processing
- **📋 Issue Updates** (`issues`) - Dependency tracking on issue closure
- **⏰ Scheduled Runs** (`schedule`) - Periodic dependency resolution

### Comprehensive Example

```yaml
name: Taskmaster Complete Workflow

on:
  workflow_dispatch:
    inputs:
      complexity-threshold:
        description: 'Complexity threshold (1-100)'
        required: false
        default: '40'
        type: string
      action-mode:
        description: 'Action mode'
        required: false
        default: 'full'
        type: choice
        options: ['full', 'generate', 'breakdown', 'watcher']
  
  push:
    paths: ['docs/**.prd.md']
    branches: [main]
  
  issue_comment:
    types: [created]
  
  issues:
    types: [closed, reopened]
  
  schedule:
    - cron: '*/10 9-18 * * 1-5'  # Business hours
    - cron: '0 * * * *'          # Off-hours

permissions:
  issues: write
  contents: read

jobs:
  taskmaster:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cmbrose/task-master-issues@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

For detailed trigger configuration, see [Trigger Configuration Guide](docs/trigger-configuration.md).

### Alternative: Use Individual Actions

You can also use the individual actions separately:
```yaml
# Use only the generate action
- uses: cmbrose/task-master-issues/actions/taskmaster-generate@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Use only the breakdown action
- uses: cmbrose/task-master-issues/actions/taskmaster-breakdown@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

# Use only the watcher action
- uses: cmbrose/task-master-issues/actions/taskmaster-watcher@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## PRD File Format

The actions expect PRD (Product Requirements Document) files in Markdown format. Here's a simple example:

```markdown
# Example Product Requirements Document

## Overview
Build a simple notification system for our application.

## Core Features
1. **Email Notifications**: Send emails to users about important events
2. **Push Notifications**: Send mobile push notifications  

## Technical Architecture
- REST API for notification management
- Email service integration (SendGrid)
- Push notification service (Firebase)

## Development Roadmap

### Phase 1: Foundation
- Set up notification service infrastructure
- Implement basic email notification functionality

### Phase 2: Mobile Integration  
- Add push notification capability
- Integrate with mobile apps

## Logical Dependency Chain
1. Infrastructure setup must be completed first
2. Email notifications build on the infrastructure
3. Push notifications require the preference system
```

The Taskmaster CLI will parse this structure and create a hierarchical task breakdown based on the phases, features, and dependencies described.

## Usage Examples

### 🚀 Generate Issues from PRD Files

Automatically create GitHub issues when PRD files are modified:

```yaml
name: Generate Tasks
on:
  push:
    paths: ['docs/**.prd.md']
  pull_request:
    paths: ['docs/**.prd.md']

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Issues from PRD
        uses: cmbrose/task-master-issues@v1
        with:
          complexity-threshold: '40'
          max-depth: '3'
          prd-path-glob: 'docs/**.prd.md'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Key Features:**
- **Push Events**: Creates and updates issues normally
- **Pull Request Events**: Runs in dry-run mode for preview/analysis
- **Configurable**: Use `prd-path-glob` to customize which files trigger the workflow

**Repository Checkout:** The action automatically handles repository checkout. For manual control:

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4
  - name: Generate Issues
    uses: cmbrose/task-master-issues@v1
    with:
      skip-checkout: 'true'
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs:**
- `repository` (optional): Repository name (owner/repo) to checkout
- `ref` (optional): Branch, tag, or SHA to checkout  
- `checkout-token` (optional): GitHub token for checkout (defaults to github-token)
- `ssh-key` (optional): SSH private key for repository access
- `fetch-depth` (optional, default: `1`): Number of commits to fetch
- `skip-checkout` (optional, default: `false`): Skip repository checkout
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
      - name: Break Down Issue
        uses: cmbrose/task-master-issues/actions/taskmaster-breakdown@v1
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
      - name: Update Dependencies
        uses: cmbrose/task-master-issues/actions/taskmaster-watcher@v1
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

### Repository Checkout Configuration

All Taskmaster actions include built-in repository checkout capabilities:

**Basic checkout options:**
- `repository`: Repository to checkout (defaults to current repo)
- `ref`: Branch, tag, or SHA to checkout
- `checkout-token`: GitHub token for authentication
- `ssh-key`: SSH private key for authentication
- `fetch-depth`: Number of commits to fetch (default: 1)
- `skip-checkout`: Skip automatic checkout

**For private repositories:**
```yaml
- uses: cmbrose/task-master-issues@v1
  with:
    repository: 'owner/private-repo'
    checkout-token: ${{ secrets.PRIVATE_REPO_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

**For SSH authentication:**
```yaml
- uses: cmbrose/task-master-issues@v1
  with:
    ssh-key: ${{ secrets.SSH_PRIVATE_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

See [Repository Checkout Documentation](docs/repository-checkout.md) for complete configuration options.

## Complete Workflow Example

### Using the Composite Action (Recommended)

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

permissions:
  issues: write
  contents: read

jobs:
  taskmaster:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Run Taskmaster
        id: taskmaster
        uses: cmbrose/task-master-issues@v1
        with:
          complexity-threshold: '40'
          max-depth: '3'
          prd-path-glob: 'docs/**.prd.md'
          breakdown-max-depth: '2'
          action-mode: 'full'
          scan-mode: ${{ github.event_name == 'schedule' && 'full' || 'webhook' }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Upload Task Graph
        if: steps.taskmaster.outputs.task-graph
        uses: actions/upload-artifact@v4
        with:
          name: task-graph
          path: ${{ steps.taskmaster.outputs.task-graph }}
```

### Using Individual Actions

For more granular control, you can use individual actions:

```yaml
name: Taskmaster Individual Actions

on:
  push:
    paths: ['docs/**.prd.md']
  issue_comment:
    types: [created]
  issues:
    types: [closed]
  schedule:
    - cron: '*/10 * * * *'

permissions:
  issues: write
  contents: read

jobs:
  generate-from-prd:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Generate Issues
        id: generate
        uses: cmbrose/task-master-issues/actions/taskmaster-generate@v1
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
        uses: cmbrose/task-master-issues/actions/taskmaster-breakdown@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

  watch-dependencies:
    if: github.event_name == 'issues' || github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Update Dependencies
        uses: cmbrose/task-master-issues/actions/taskmaster-watcher@v1
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

## CI/CD Pipeline

This repository implements a comprehensive CI/CD pipeline for automated build, test, security scanning, and deployment.

### Pipeline Components

- **Continuous Integration**: Automated build, linting, and testing on every push and pull request
- **Security Scanning**: Daily vulnerability scans, dependency auditing, and secret detection
- **Automated Testing**: Unit tests, integration tests, and action validation
- **Release Management**: Automated GitHub releases and marketplace updates
- **Quality Gates**: Code coverage, security compliance, and performance validation

### Workflows

- [`ci-cd-pipeline.yml`](.github/workflows/ci-cd-pipeline.yml) - Main CI/CD workflow
- [`security-scanning.yml`](.github/workflows/security-scanning.yml) - Security and vulnerability scanning  
- [`release-deployment.yml`](.github/workflows/release-deployment.yml) - Automated releases

### Running Tests Locally

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:triggers
npm run test:generate
npm run test:integration-hierarchy

# All tests
npm run test:all
```

For detailed CI/CD documentation, see [docs/ci-cd-pipeline.md](docs/ci-cd-pipeline.md).

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