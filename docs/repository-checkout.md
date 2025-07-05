# Repository Checkout Configuration

This document explains the repository checkout configuration options available in the Taskmaster GitHub Actions.

## Overview

All Taskmaster actions now include comprehensive repository checkout configuration to support:
- Private repositories with proper authentication
- Custom repository sources and branches
- SSH key authentication
- Workspace preparation with various checkout options
- Performance optimization through shallow clones

## Configuration Options

### Repository Source
- `repository`: Repository name (owner/repo) to checkout (defaults to current repository)
- `ref`: Branch, tag, or SHA to checkout (defaults to repository default branch)

### Authentication
- `checkout-token`: GitHub token for repository access (defaults to `github-token` if not specified)
- `ssh-key`: SSH private key for repository access (alternative to token authentication)

### Performance & Workspace
- `fetch-depth`: Number of commits to fetch (0 = all history, 1 = shallow clone, default: 1)
- `checkout-path`: Relative path where repository will be placed
- `clean`: Execute git clean before fetching (default: true)
- `persist-credentials`: Persist credentials for later git operations (default: true)

### Control Options
- `skip-checkout`: Skip repository checkout step (assumes repository already checked out)

## Usage Examples

### Basic Usage (Automatic Checkout)
```yaml
- name: Run Taskmaster
  uses: cmbrose/task-master-issues@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Private Repository with Token
```yaml
- name: Run Taskmaster on Private Repo
  uses: cmbrose/task-master-issues@v1
  with:
    repository: 'owner/private-repo'
    checkout-token: ${{ secrets.PRIVATE_REPO_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### SSH Key Authentication
```yaml
- name: Run Taskmaster with SSH
  uses: cmbrose/task-master-issues@v1
  with:
    repository: 'git@github.com:owner/repo.git'
    ssh-key: ${{ secrets.SSH_PRIVATE_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Specific Branch/Tag
```yaml
- name: Run Taskmaster on Feature Branch
  uses: cmbrose/task-master-issues@v1
  with:
    ref: 'feature/new-functionality'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Shallow Clone for Performance
```yaml
- name: Run Taskmaster with Shallow Clone
  uses: cmbrose/task-master-issues@v1
  with:
    fetch-depth: '1'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Custom Workspace Path
```yaml
- name: Run Taskmaster in Subfolder
  uses: cmbrose/task-master-issues@v1
  with:
    checkout-path: 'taskmaster-workspace'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Skip Checkout (Manual Control)
```yaml
jobs:
  taskmaster:
    runs-on: ubuntu-latest
    steps:
      - name: Custom Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history
          submodules: true
          
      - name: Run Taskmaster
        uses: cmbrose/task-master-issues@v1
        with:
          skip-checkout: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Individual Actions

All individual actions (`taskmaster-generate`, `taskmaster-breakdown`, `taskmaster-watcher`) support the same checkout configuration options:

```yaml
- name: Generate Issues with Custom Checkout
  uses: cmbrose/task-master-issues/actions/taskmaster-generate@v1
  with:
    repository: 'owner/docs-repo'
    ref: 'main'
    fetch-depth: '1'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Security Considerations

### Token Permissions
Ensure your GitHub token has appropriate permissions:
- `contents:read` - Required for repository checkout
- `issues:write` - Required for Taskmaster functionality
- `metadata:read` - Required for repository metadata

### SSH Keys
When using SSH authentication:
- Store SSH private key in repository secrets
- Ensure the key has appropriate access to the target repository
- Consider using deploy keys for repository-specific access

### Private Repositories
For private repositories:
- Use a personal access token with appropriate repository access
- Consider using a machine user for automated workflows
- Store sensitive tokens in repository or organization secrets

## Troubleshooting

### Common Issues

**Checkout fails with authentication error**
- Verify token has `contents:read` permission
- For private repos, ensure token has access to the specific repository

**SSH authentication fails**
- Verify SSH key format (should be private key, not public key)
- Ensure SSH key is associated with an account that has repository access

**Workspace conflicts**
- Use different `checkout-path` for multiple repository checkouts
- Enable `clean: true` to ensure clean workspace state

### Debug Information
Enable debug logging to troubleshoot checkout issues:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

## Migration Guide

### From Manual Checkout
If you currently use manual checkout steps:

**Before:**
```yaml
steps:
  - uses: actions/checkout@v4
  - uses: cmbrose/task-master-issues@v1
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

**After (Option 1 - Let action handle checkout):**
```yaml
steps:
  - uses: cmbrose/task-master-issues@v1
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

**After (Option 2 - Keep manual checkout):**
```yaml
steps:
  - uses: actions/checkout@v4
  - uses: cmbrose/task-master-issues@v1
    with:
      skip-checkout: 'true'
      github-token: ${{ secrets.GITHUB_TOKEN }}
```