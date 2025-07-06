# Setup Instructions

This guide provides step-by-step instructions for setting up the Task Master Issues GitHub Actions in your repository.

## Prerequisites

- GitHub repository with admin access
- Node.js 16+ and npm (for local development)
- GitHub token with repo permissions

## Quick Start

### 1. Install the GitHub Action

Add the action to your repository using one of these methods:

#### Option A: Use as a GitHub Action (Recommended)

Create `.github/workflows/taskmaster.yml`:

```yaml
name: Taskmaster Issue Generation

on:
  push:
    paths:
      - 'docs/**/*.prd.md'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run in dry-run mode (preview only)'
        required: false
        default: 'false'
        type: boolean

jobs:
  generate-issues:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
      pull-requests: write
      
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        
      - name: Generate Issues from PRD
        uses: cmbrose/task-master-issues@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          prd-paths: 'docs/**/*.prd.md'
          dry-run: ${{ github.event.inputs.dry_run || 'false' }}
          complexity-threshold: 6
```

#### Option B: Use as a Reusable Workflow

Create `.github/workflows/taskmaster.yml`:

```yaml
name: Taskmaster Issue Generation

on:
  push:
    paths:
      - 'docs/**/*.prd.md'
  workflow_dispatch:

jobs:
  generate-issues:
    uses: cmbrose/task-master-issues/.github/workflows/taskmaster-generate.yml@main
    with:
      prd-paths: 'docs/**/*.prd.md'
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Create Your First PRD

Create a PRD file in `docs/your-feature.prd.md`:

```markdown
---
task_id: feature-001
title: User Authentication System
complexity: 8
priority: high
labels: [backend, security, api]
estimated_hours: 32
---

# User Authentication System

## Overview
Implement a secure user authentication system with JWT tokens.

## Requirements

### Epic 1: Authentication Backend
- Implement JWT token generation
- Create user registration endpoint
- Develop login/logout functionality
- Add password reset capability

### Feature 1.1: JWT Implementation
- Set up JWT library
- Create token generation utilities
- Implement token validation middleware

### Task 1.1.1: Install Dependencies
- Add jsonwebtoken package
- Configure environment variables
- Set up security middleware

## Dependencies
- User database schema must be completed first
- OAuth integration (if required)

## Acceptance Criteria
- [ ] Users can register new accounts
- [ ] Users can log in with email/password
- [ ] JWT tokens expire appropriately
- [ ] Password reset emails are sent
```

### 3. Commit and Push

```bash
git add docs/your-feature.prd.md .github/workflows/taskmaster.yml
git commit -m "Add Taskmaster workflow and first PRD"
git push
```

The workflow will automatically:
- Parse your PRD file
- Create GitHub issues for each task
- Set up dependencies between issues
- Add appropriate labels and metadata

## Advanced Setup

### Environment Variables

Configure these environment variables for advanced features:

```yaml
env:
  # GitHub Configuration
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  GITHUB_OWNER: ${{ github.repository_owner }}
  GITHUB_REPO: ${{ github.event.repository.name }}
  
  # Taskmaster Configuration
  TASKMASTER_DRY_RUN: 'false'
  COMPLEXITY_THRESHOLD: '6'
  MAX_BATCH_SIZE: '20'
  
  # Performance Tuning
  ENABLE_BATCH_PROCESSING: 'true'
  BATCH_DELAY_MS: '1000'
  MAX_RETRIES: '3'
  
  # Logging
  LOG_LEVEL: 'info'
  ENABLE_DEBUG_LOGS: 'false'
```

### Custom Configuration

Create `.taskmaster/config.yml` for advanced configuration:

```yaml
# Taskmaster Configuration
parsing:
  prd_patterns:
    - "docs/**/*.prd.md"
    - "requirements/**/*.md"
  
  complexity_mapping:
    low: 1-3
    medium: 4-6
    high: 7-8
    epic: 9-10

issue_creation:
  default_labels:
    - taskmaster-generated
    - needs-triage
  
  label_mapping:
    backend: [backend, api]
    frontend: [frontend, ui]
    database: [database, schema]
  
  complexity_labels:
    1-3: low-complexity
    4-6: medium-complexity
    7-8: high-complexity
    9-10: epic

dependency_management:
  auto_blocking: true
  update_frequency: "*/10 * * * *"  # Every 10 minutes
  
performance:
  batch_size: 15
  max_concurrent: 5
  timeout_ms: 30000
```

## Repository Structure

Organize your repository for optimal Taskmaster usage:

```
your-repo/
├── .github/
│   └── workflows/
│       ├── taskmaster.yml          # Main workflow
│       ├── taskmaster-breakdown.yml # Issue breakdown
│       └── taskmaster-watcher.yml   # Dependency monitoring
├── .taskmaster/
│   ├── config.yml                  # Configuration
│   └── templates/                  # Issue templates
├── docs/
│   ├── features/
│   │   ├── auth.prd.md            # Feature PRDs
│   │   └── payments.prd.md
│   └── epics/
│       └── user-management.prd.md  # Epic PRDs
└── README.md
```

## Testing Your Setup

### 1. Dry Run Test

Test without creating actual issues:

```bash
gh workflow run taskmaster.yml -f dry_run=true
```

### 2. Manual Validation

Run the smoke tests locally:

```bash
# Clone the repository
git clone https://github.com/cmbrose/task-master-issues
cd task-master-issues

# Install dependencies
npm install

# Run smoke tests
npm run test:smoke
```

### 3. Performance Validation

Test the 5-minute runtime requirement:

```bash
npm run test:5min-prd
```

## Troubleshooting Setup

### Common Issues

1. **Workflow not triggering**
   - Check file paths in workflow trigger
   - Verify PRD files are in tracked directories
   - Ensure proper file naming (*.prd.md)

2. **Permission errors**
   - Verify workflow has `issues: write` permission
   - Check GitHub token scope includes repo access
   - Ensure repository settings allow workflow execution

3. **Issues not created**
   - Check workflow logs for errors
   - Verify PRD YAML frontmatter format
   - Test with dry-run mode first

4. **Performance issues**
   - Reduce batch size in configuration
   - Check for API rate limits
   - Monitor workflow execution time

### Getting Help

- Check the [Troubleshooting Guide](troubleshooting-guide.md)
- Review [Configuration Documentation](configuration-options.md)
- See [User Guide](user-guide.md) for usage examples
- Create an issue in the [Task Master Issues repository](https://github.com/cmbrose/task-master-issues/issues)

## Next Steps

1. Read the [User Guide](user-guide.md) for usage patterns
2. Explore [Configuration Options](configuration-options.md)
3. Set up [Issue Breakdown Commands](user-guide.md#breakdown-commands)
4. Configure [Dependency Monitoring](user-guide.md#dependency-management)

## Migration from Other Tools

### From Manual Issue Creation
- Export existing issues as PRD format
- Use Taskmaster's dry-run mode to validate
- Gradually migrate project by project

### From Other Automation Tools
- Map existing configurations to Taskmaster format
- Test side-by-side before switching
- Preserve existing issue relationships

For detailed migration guides, see the [Migration Documentation](migration-guide.md).