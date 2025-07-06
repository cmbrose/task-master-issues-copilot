# Deployment Guide

Complete step-by-step guide for deploying the Task Master Issues system in your GitHub repository.

## Prerequisites

### System Requirements
- GitHub repository with Actions enabled
- Node.js 18+ (for local development and testing)
- Git command line tools
- Text editor or IDE

### GitHub Permissions
- Repository admin access (to configure Actions and secrets)
- Ability to create and manage GitHub Issues
- Permission to upload and manage GitHub Artifacts

### Required Information
- GitHub Personal Access Token with appropriate permissions
- Repository owner and name
- Taskmaster CLI binary access (automatically downloaded)

## Quick Start (5 Minutes)

For users who want to get started immediately:

```bash
# 1. Use this repository as a template
# Click "Use this template" on GitHub or clone directly

# 2. Configure your GitHub token
# Go to repository Settings > Secrets and variables > Actions
# Add GITHUB_TOKEN secret with your personal access token

# 3. Create your first PRD
# Copy docs/sample-test.prd.md to docs/my-feature.prd.md
# Edit the content to describe your feature

# 4. Push to trigger issue generation
git add docs/my-feature.prd.md
git commit -m "Add my first feature PRD"
git push origin main

# Issues will be created automatically within 2-3 minutes
```

## Detailed Setup

### Step 1: Repository Setup

#### Option A: Use as Template Repository
1. Visit the Task Master Issues repository on GitHub
2. Click "Use this template" button
3. Choose repository name and visibility settings
4. Click "Create repository from template"

#### Option B: Fork the Repository
1. Click the "Fork" button on the repository page
2. Select your account or organization
3. Optionally rename the repository

#### Option C: Clone and Customize
```bash
# Clone the repository
git clone https://github.com/cmbrose/task-master-issues.git my-taskmaster
cd my-taskmaster

# Remove original git history (optional)
rm -rf .git
git init
git remote add origin <your-repository-url>

# Make initial commit
git add .
git commit -m "Initial Task Master Issues setup"
git push -u origin main
```

### Step 2: GitHub Token Configuration

#### Creating a Personal Access Token
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Click "Generate new token" > "Generate new token (classic)"
3. Select appropriate scopes:
   ```
   ✓ repo                    # Full repository access
   ✓ workflow               # Update GitHub Actions workflows
   ✓ write:packages         # Upload artifacts (if needed)
   ```
4. Click "Generate token" and copy the token value

#### Configuring Repository Secrets
1. Navigate to your repository on GitHub
2. Go to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add the following secrets:

```
Name: GITHUB_TOKEN
Value: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Name: TASKMASTER_CONFIG (optional)
Value: {"complexity_threshold": 4, "max_depth": 3}
```

### Step 3: Environment Configuration

#### Local Development Setup
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env file with your settings
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name
TASKMASTER_COMPLEXITY_THRESHOLD=4
TASKMASTER_MAX_DEPTH=3
TASKMASTER_DRY_RUN=false
```

#### Configuration File Setup
Create `.taskmaster/config.yml` for repository-specific settings:

```yaml
# Core task generation settings
complexity_threshold: 4      # Break down tasks larger than 4 hours
max_depth: 3                # Maximum breakdown recursion depth
dry_run: false              # Set to true to preview without creating issues

# GitHub API configuration
github:
  rate_limit_buffer: 100    # API calls to reserve for critical operations
  retry_max_attempts: 5     # Maximum retry attempts for failed operations
  retry_delay_ms: 1000     # Base delay between retries

# Performance settings
concurrency: 3              # Maximum concurrent API operations
batch_size: 10              # Number of items to process in each batch

# Artifact management
artifacts:
  retention_days: 30        # How long to keep task graph artifacts
  max_size_mb: 10          # Maximum size for individual artifacts
  
# Labeling configuration
labels:
  taskmaster: "taskmaster"  # Primary label for all generated issues
  blocked: "blocked"        # Label for issues with open dependencies
  ready: "ready"           # Label for issues ready to work on
  complexity:
    low: "complexity:low"   # 1-2 hours
    medium: "complexity:medium"  # 3-4 hours  
    high: "complexity:high" # 5+ hours (will be broken down)
```

### Step 4: Workflow Configuration

The repository includes pre-configured GitHub Actions workflows. Verify they are properly configured:

#### `.github/workflows/taskmaster.yml`
```yaml
name: Taskmaster Issue Management

on:
  push:
    paths: 
      - 'docs/**/*.prd.md'     # Trigger on PRD file changes
  issue_comment:
    types: [created]           # Handle /breakdown commands
  issues:
    types: [closed]            # Update dependencies when issues close
  schedule:
    - cron: '*/10 * * * *'     # Health check every 10 minutes

jobs:
  generate:
    if: github.event_name == 'push'
    uses: ./.github/workflows/generate.yml
    secrets: inherit

  breakdown:
    if: github.event_name == 'issue_comment' && contains(github.event.comment.body, '/breakdown')
    uses: ./.github/workflows/breakdown.yml
    secrets: inherit

  watcher:
    if: github.event_name == 'issues' || github.event_name == 'schedule'
    uses: ./.github/workflows/watcher.yml
    secrets: inherit
```

#### Workflow Permissions
Ensure workflows have necessary permissions in repository settings:

1. Go to Settings > Actions > General
2. Set "Workflow permissions" to "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"

### Step 5: Testing and Validation

#### Local Testing
```bash
# Test configuration
npm run lint

# Test individual components (requires GitHub token)
npm run test:github-api-simple

# Run comprehensive tests (optional, requires GitHub access)
npm run test:all
```

#### Creating Test PRD
Create a test PRD file to validate the system:

```bash
# Create test PRD
cat > docs/test-feature.prd.md << 'EOF'
# Test Feature
**Doc version**: v1.0
**Status**: Draft

## Purpose & Goals
Test the Task Master Issues system with a simple feature.

## User Stories
1. As a user, I want to see issues created automatically
2. As a developer, I want to work on right-sized tasks

## Technical Requirements
- Simple implementation
- Basic testing
- Documentation updates

## Tasks
- Setup: Configure test environment (2 hours)
- Implementation: Build core feature (3 hours)  
- Testing: Add test coverage (2 hours)
- Documentation: Update user guide (1 hour)
EOF

# Commit and push to trigger issue generation
git add docs/test-feature.prd.md
git commit -m "Add test feature PRD"
git push origin main
```

#### Verifying Deployment
1. Check GitHub Actions tab for workflow execution
2. Verify issues are created within 5 minutes
3. Test `/breakdown` command on any generated issue
4. Confirm dependency tracking works by closing an issue

### Step 6: Production Configuration

#### Performance Tuning
For production use, adjust settings based on your team size and repository activity:

```yaml
# High-activity repository settings
concurrency: 5              # More concurrent operations
batch_size: 20              # Larger batch sizes
github:
  rate_limit_buffer: 200    # Larger buffer for safety
  retry_max_attempts: 7     # More retries for reliability
```

#### Monitoring Setup
Configure monitoring and alerting:

```yaml
# Add to .taskmaster/config.yml
monitoring:
  enabled: true
  error_threshold: 5        # Alert after 5 consecutive errors
  performance_threshold: 300 # Alert if actions take >5 minutes
  
logging:
  level: "info"             # info, debug, warn, error
  include_performance: true
  include_api_calls: false  # Set true for debugging
```

#### Security Hardening
1. **Rotate GitHub tokens regularly** (every 90 days recommended)
2. **Use least-privilege tokens** (only required permissions)
3. **Monitor repository access logs**
4. **Review workflow permissions periodically**

### Step 7: Team Onboarding

#### For Contributors
1. Share the [User Guide](./user-guide.md)
2. Demonstrate issue workflow:
   - Finding ready issues
   - Using `/breakdown` command
   - Closing issues to unblock dependencies

#### For Maintainers
1. Review [Configuration Management](./configuration-management.md)
2. Set up monitoring dashboards
3. Configure alert notifications
4. Plan regular system health checks

#### For Product Managers
1. Provide PRD writing guidelines
2. Show PRD-to-issues workflow
3. Explain dependency management
4. Set up progress tracking

## Advanced Configuration

### Multi-Environment Setup

#### Development Environment
```yaml
# .taskmaster/dev.yml
complexity_threshold: 2     # Lower threshold for testing
max_depth: 2               # Reduced depth for faster testing
dry_run: false
artifacts:
  retention_days: 7        # Shorter retention for dev
```

#### Staging Environment
```yaml
# .taskmaster/staging.yml  
complexity_threshold: 4
max_depth: 3
dry_run: false            # Full testing
artifacts:
  retention_days: 14
```

#### Production Environment
```yaml
# .taskmaster/production.yml
complexity_threshold: 4
max_depth: 3
dry_run: false
artifacts:
  retention_days: 90      # Longer retention for audit
monitoring:
  enabled: true
  alerts: true
```

### Custom Labeling Strategy

Configure custom labels for your team's workflow:

```yaml
labels:
  # Priority labels
  priority:
    critical: "priority:critical"
    high: "priority:high"
    medium: "priority:medium"
    low: "priority:low"
  
  # Team labels
  teams:
    frontend: "team:frontend"
    backend: "team:backend"
    qa: "team:qa"
    devops: "team:devops"
  
  # Size labels (T-shirt sizing)
  size:
    xs: "size:xs"         # <1 hour
    s: "size:s"           # 1-2 hours
    m: "size:m"           # 3-4 hours
    l: "size:l"           # 5-8 hours (will be broken down)
    xl: "size:xl"         # >8 hours (will be broken down)
```

### Integration with External Tools

#### Slack Integration
Add Slack webhook for notifications:

```yaml
integrations:
  slack:
    webhook_url: "${SLACK_WEBHOOK_URL}"  # Add to GitHub secrets
    channels:
      general: "#taskmaster-general"
      errors: "#taskmaster-alerts"
    notifications:
      issue_created: true
      breakdown_completed: true
      errors: true
```

#### Jira Integration
For teams using both GitHub and Jira:

```yaml
integrations:
  jira:
    base_url: "https://yourcompany.atlassian.net"
    username: "${JIRA_USERNAME}"
    api_token: "${JIRA_API_TOKEN}"
    project_key: "PROJ"
    sync_enabled: true
```

## Troubleshooting

### Common Deployment Issues

#### Issue: Actions not triggering
**Symptoms**: PRD changes don't create issues
**Solutions**:
1. Check workflow file syntax
2. Verify file paths match trigger patterns
3. Ensure Actions are enabled in repository settings
4. Check GitHub token permissions

#### Issue: Authentication failures
**Symptoms**: "403 Forbidden" or "401 Unauthorized" errors
**Solutions**:
1. Verify GitHub token is correctly configured
2. Check token has required permissions
3. Ensure token hasn't expired
4. Test token with GitHub API directly

#### Issue: Rate limiting
**Symptoms**: "Rate limit exceeded" errors
**Solutions**:
1. Reduce concurrency settings
2. Increase rate limit buffer
3. Check for other API usage in repository
4. Consider using GitHub Apps instead of personal tokens

#### Issue: Performance problems
**Symptoms**: Actions taking longer than 5 minutes
**Solutions**:
1. Reduce PRD complexity or split into multiple files
2. Increase concurrency if rate limits allow
3. Check GitHub Actions runner availability
4. Optimize batch processing settings

### Getting Help

#### Self-Service Resources
1. **System Health Check**: Run `npm run test:github-api-simple`
2. **Configuration Validation**: Use `npm run lint`  
3. **Debug Logging**: Set `TASKMASTER_DEBUG=true`
4. **Performance Metrics**: Check GitHub Actions logs

#### Community Support
1. **Documentation**: Review all guides in `/docs` directory
2. **Issues**: Search existing GitHub issues for similar problems
3. **Discussions**: Use GitHub Discussions for questions
4. **Examples**: Reference working configurations in repository

#### Creating Support Requests
When requesting help, include:
- Repository URL and configuration files
- Error messages and GitHub Actions logs
- Steps to reproduce the issue
- Expected vs. actual behavior
- System information (Node.js version, OS, etc.)

## Maintenance and Updates

### Regular Maintenance Tasks
- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update GitHub tokens and check permissions
- **Quarterly**: Review and update configuration settings
- **Annually**: Update dependencies and security audit

### Updating the System
```bash
# Update to latest version
git fetch upstream
git merge upstream/main

# Update dependencies
npm update

# Test configuration
npm run test:all

# Deploy updates
git push origin main
```

### Backup and Recovery
- **Configuration**: Store configuration files in version control
- **Artifacts**: GitHub Artifacts provide automatic backup
- **Issues**: GitHub Issues are automatically preserved
- **Recovery**: Use artifact replay for disaster recovery

## Related Documentation

- [User Guide](./user-guide.md) - Comprehensive user documentation
- [API Reference](./api-reference.md) - Complete API documentation  
- [Architecture Overview](./architecture-overview.md) - System design and components
- [Configuration Management](./configuration-management.md) - Configuration options and examples