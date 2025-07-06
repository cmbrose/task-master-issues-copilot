# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Task Master Issues.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Performance Issues](#performance-issues)
- [Configuration Problems](#configuration-problems)
- [GitHub API Issues](#github-api-issues)
- [Workflow Problems](#workflow-problems)
- [Debug Tools](#debug-tools)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Commands

Run these commands to quickly diagnose issues:

```bash
# Check system health
npm run test:smoke

# Validate configuration
npm run config:validate

# Test GitHub API connectivity
npm run test:github-api-simple

# Performance validation
npm run test:5min-prd

# Check dependencies
npm run test:dependencies
```

### Smoke Test Results

✅ **All Green**: System is healthy
⚠️ **Some Warnings**: Minor issues, system functional
❌ **Failures**: Critical issues require attention

## Common Issues

### 1. Workflow Not Triggering

**Symptoms:**
- GitHub Actions workflow doesn't start
- No activity in Actions tab
- PRD changes don't trigger automation

**Diagnostics:**
```bash
# Check workflow file syntax
gh workflow list
gh workflow view taskmaster.yml

# Verify file patterns
ls docs/**/*.prd.md
```

**Solutions:**

1. **Verify workflow file location:**
   ```
   ✅ .github/workflows/taskmaster.yml
   ❌ .github/workflow/taskmaster.yml
   ❌ github/workflows/taskmaster.yml
   ```

2. **Check file path patterns:**
   ```yaml
   # Correct patterns
   on:
     push:
       paths:
         - 'docs/**/*.prd.md'
         - '!docs/archive/**'
   
   # Common mistakes
   paths:
     - docs/*.prd.md        # Missing /**
     - 'docs/**/*.prd'      # Missing .md
   ```

3. **Verify branch configuration:**
   ```yaml
   on:
     push:
       branches: [main, master]  # Specify target branches
       paths: ['docs/**/*.prd.md']
   ```

### 2. Issues Not Created

**Symptoms:**
- Workflow runs successfully
- No GitHub issues created
- No error messages

**Diagnostics:**
```bash
# Check workflow logs
gh run list --workflow=taskmaster.yml
gh run view <run-id> --log

# Test with dry-run
gh workflow run taskmaster.yml -f dry_run=true
```

**Solutions:**

1. **Check PRD file format:**
   ```markdown
   ---
   task_id: example-001     # Required
   title: Example Task      # Required
   complexity: 5            # Required (1-10)
   priority: high           # Optional
   ---
   
   # Content must follow YAML frontmatter
   ```

2. **Verify GitHub token permissions:**
   ```yaml
   permissions:
     issues: write          # Required for issue creation
     contents: read         # Required for file access
     pull-requests: write   # Required for PR comments
   ```

3. **Check repository settings:**
   - Issues must be enabled in repository settings
   - Actions must be allowed to create issues
   - Branch protection rules may block automation

### 3. Permission Errors

**Symptoms:**
- "Insufficient permissions" errors
- 403 Forbidden responses
- Authentication failures

**Diagnostics:**
```bash
# Test token permissions
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/repos/OWNER/REPO

# Check token scopes
gh auth status
```

**Solutions:**

1. **Update workflow permissions:**
   ```yaml
   jobs:
     generate-issues:
       permissions:
         issues: write
         contents: read
         pull-requests: write
         metadata: read
   ```

2. **Verify token scopes:**
   Required scopes: `repo`, `workflow`, `write:packages`
   
3. **Check organization settings:**
   - Third-party access restrictions
   - SAML/SSO requirements
   - Branch protection rules

### 4. PRD Parsing Errors

**Symptoms:**
- "Invalid YAML frontmatter" errors
- Missing task metadata
- Incorrect issue creation

**Diagnostics:**
```bash
# Validate YAML syntax
npm run demo:issue-parser

# Test specific file
npx ts-node -e "
const parser = require('./scripts/issue-parser');
parser.validatePrdFile('docs/your-file.prd.md');
"
```

**Solutions:**

1. **Fix YAML frontmatter:**
   ```markdown
   ---
   task_id: feature-001
   title: "User Authentication"
   complexity: 7
   priority: high
   labels:
     - backend
     - security
   estimated_hours: 24
   dependencies:
     - auth-database-schema
   ---
   ```

2. **Common YAML mistakes:**
   ```markdown
   # ❌ Wrong format
   ---
   task_id = feature-001      # Use colon, not equals
   title: User Authentication # Missing quotes for special chars
   complexity: "high"         # Use number, not string
   ---
   
   # ✅ Correct format
   ---
   task_id: feature-001
   title: "User Authentication"
   complexity: 7
   ---
   ```

## Performance Issues

### 1. Slow Workflow Execution

**Symptoms:**
- Workflows taking longer than 5 minutes
- Timeouts in GitHub Actions
- High memory usage

**Diagnostics:**
```bash
# Performance test
npm run test:5min-prd

# Load testing
npm run test:load-testing

# Memory profiling
npm run test:memory-usage
```

**Solutions:**

1. **Optimize batch processing:**
   ```yaml
   with:
     batch-size: '10'          # Reduce for large PRDs
     max-concurrent: '3'       # Reduce for rate limiting
     batch-delay: '2000'       # Increase for stability
   ```

2. **Enable checkpointing:**
   ```yaml
   with:
     enable-checkpointing: 'true'
   ```

3. **Tune performance settings:**
   ```yaml
   env:
     MAX_BATCH_SIZE: '15'
     BATCH_DELAY_MS: '1000'
     MAX_RETRIES: '3'
     ENABLE_CIRCUIT_BREAKER: 'true'
   ```

### 2. Rate Limiting

**Symptoms:**
- "API rate limit exceeded" errors
- 403 responses with X-RateLimit headers
- Exponential backoff delays

**Diagnostics:**
```bash
# Check rate limit status
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/rate_limit

# Monitor rate limiting
npm run test:rate-limit-monitoring
```

**Solutions:**

1. **Reduce request frequency:**
   ```yaml
   with:
     batch-delay: '2000'      # 2 second delay
     max-concurrent: '2'      # Reduce concurrency
   ```

2. **Enable rate limit handling:**
   ```yaml
   env:
     ENABLE_RATE_LIMIT_RETRY: 'true'
     RATE_LIMIT_BACKOFF_MS: '60000'
   ```

3. **Use GitHub App tokens** (higher rate limits):
   ```yaml
   - uses: tibdex/github-app-token@v1
     id: generate-token
     with:
       app_id: ${{ secrets.APP_ID }}
       private_key: ${{ secrets.APP_PRIVATE_KEY }}
   ```

### 3. Memory Issues

**Symptoms:**
- Out of memory errors
- Slow garbage collection
- Process termination

**Diagnostics:**
```bash
# Memory profiling
npm run test:memory-profiling

# Monitor memory usage
npm run test:memory-monitoring
```

**Solutions:**

1. **Reduce memory usage:**
   ```yaml
   with:
     batch-size: '5'          # Smaller batches
     stream-processing: 'true' # Process incrementally
   ```

2. **Optimize Node.js settings:**
   ```yaml
   env:
     NODE_OPTIONS: '--max-old-space-size=2048'
   ```

## Configuration Problems

### 1. Invalid Configuration

**Symptoms:**
- Configuration validation errors
- Unexpected behavior
- Missing features

**Diagnostics:**
```bash
# Validate configuration
npm run config:validate

# Check configuration schema
npm run config:schema-check

# Debug configuration loading
DEBUG=config npm run start
```

**Solutions:**

1. **Use configuration validator:**
   ```bash
   npx taskmaster validate-config .taskmaster/config.yml
   ```

2. **Check required fields:**
   ```yaml
   # Minimum required configuration
   core:
     version: "1.0"
   parsing:
     prd_patterns:
       - "docs/**/*.prd.md"
   ```

3. **Validate YAML syntax:**
   ```bash
   # Online validator or
   python -c "import yaml; yaml.safe_load(open('.taskmaster/config.yml'))"
   ```

### 2. Environment Variable Issues

**Symptoms:**
- Configuration not taking effect
- Default values being used
- Missing environment variables

**Diagnostics:**
```bash
# Check environment variables
env | grep TASKMASTER
env | grep GITHUB

# Debug environment loading
npm run debug:env
```

**Solutions:**

1. **Set required variables:**
   ```bash
   # In workflow
   env:
     GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
     TASKMASTER_DRY_RUN: 'false'
     COMPLEXITY_THRESHOLD: '6'
   ```

2. **Use .env file for local testing:**
   ```bash
   # .env
   GITHUB_TOKEN=ghp_xxxxxxxxxxxx
   GITHUB_OWNER=your-username
   GITHUB_REPO=your-repo
   ```

## GitHub API Issues

### 1. Authentication Failures

**Symptoms:**
- 401 Unauthorized responses
- "Bad credentials" errors
- Token validation failures

**Diagnostics:**
```bash
# Test authentication
gh auth status

# Verify token
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/user
```

**Solutions:**

1. **Regenerate GitHub token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create new token with required scopes
   - Update repository secrets

2. **Check token scopes:**
   ```
   Required scopes:
   ✅ repo (full repository access)
   ✅ workflow (workflow management)
   ✅ write:packages (if using packages)
   ```

3. **Update workflow secrets:**
   ```bash
   gh secret set GITHUB_TOKEN --body "ghp_xxxxxxxxxxxx"
   ```

### 2. API Response Errors

**Symptoms:**
- Unexpected API responses
- Malformed JSON errors
- API endpoint not found

**Diagnostics:**
```bash
# Test API endpoints
npm run test:github-api-simple

# Debug API calls
DEBUG=github-api npm run start
```

**Solutions:**

1. **Check GitHub API status:**
   - Visit https://www.githubstatus.com/
   - Check for API degradations

2. **Validate API requests:**
   ```javascript
   // Enable API debugging
   process.env.DEBUG = 'github-api';
   ```

3. **Handle API errors gracefully:**
   ```yaml
   with:
     max-retries: '3'
     retry-delay: '5000'
   ```

## Workflow Problems

### 1. Workflow Syntax Errors

**Symptoms:**
- Workflow file invalid
- YAML parsing errors
- Action not found

**Diagnostics:**
```bash
# Validate workflow syntax
gh workflow list
gh workflow view taskmaster.yml

# Check action references
gh api repos/cmbrose/task-master-issues/releases/latest
```

**Solutions:**

1. **Use workflow validator:**
   ```bash
   # GitHub CLI validation
   gh workflow list --validate
   
   # Online validator
   # Copy workflow to https://yaml-online-parser.appspot.com/
   ```

2. **Check action version:**
   ```yaml
   # ✅ Use specific version
   uses: cmbrose/task-master-issues@v1.0.0
   
   # ⚠️ Use latest (may break)
   uses: cmbrose/task-master-issues@main
   ```

### 2. Dependency Issues

**Symptoms:**
- Missing dependencies
- Version conflicts
- Import errors

**Diagnostics:**
```bash
# Check dependencies
npm audit
npm outdated

# Test imports
npm run test:imports
```

**Solutions:**

1. **Update dependencies:**
   ```bash
   npm update
   npm audit fix
   ```

2. **Clear cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## Debug Tools

### 1. Enable Debug Logging

```yaml
# In workflow
with:
  debug: 'true'

env:
  DEBUG: 'taskmaster:*'
  LOG_LEVEL: 'debug'
```

### 2. Dry Run Mode

```bash
# Test without creating issues
gh workflow run taskmaster.yml -f dry_run=true

# Local dry run
TASKMASTER_DRY_RUN=true npm run start
```

### 3. Performance Profiling

```bash
# Profile memory usage
npm run profile:memory

# Profile CPU usage
npm run profile:cpu

# Generate performance report
npm run perf:report
```

### 4. API Call Monitoring

```bash
# Monitor API calls
DEBUG=github-api npm run start

# Check rate limits
npm run test:rate-limits

# Analyze API usage
npm run analyze:api-usage
```

## Debug Scripts

### Check System Health

```bash
#!/bin/bash
# scripts/debug-health.sh

echo "🔍 Task Master Issues Health Check"
echo "=================================="

# Check Node.js version
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Check GitHub CLI
if command -v gh &> /dev/null; then
    echo "GitHub CLI: $(gh --version | head -1)"
    gh auth status
else
    echo "❌ GitHub CLI not installed"
fi

# Check environment variables
echo ""
echo "Environment Variables:"
env | grep -E "(GITHUB|TASKMASTER)" | sort

# Test GitHub API
echo ""
echo "GitHub API Test:"
if [ -n "$GITHUB_TOKEN" ]; then
    curl -s -o /dev/null -w "HTTP %{http_code}\n" \
         -H "Authorization: Bearer $GITHUB_TOKEN" \
         https://api.github.com/user
else
    echo "❌ GITHUB_TOKEN not set"
fi

# Run smoke tests
echo ""
echo "Running smoke tests..."
npm run test:smoke:ci
```

### Validate Configuration

```bash
#!/bin/bash
# scripts/debug-config.sh

echo "🔧 Configuration Validation"
echo "=========================="

# Check configuration file exists
if [ -f ".taskmaster/config.yml" ]; then
    echo "✅ Configuration file found"
    
    # Validate YAML syntax
    if python3 -c "import yaml; yaml.safe_load(open('.taskmaster/config.yml'))" 2>/dev/null; then
        echo "✅ YAML syntax valid"
    else
        echo "❌ YAML syntax invalid"
        python3 -c "import yaml; yaml.safe_load(open('.taskmaster/config.yml'))"
    fi
else
    echo "⚠️ No configuration file found (using defaults)"
fi

# Validate workflow files
echo ""
echo "Workflow Validation:"
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        echo "Checking $(basename "$workflow")..."
        gh workflow view "$(basename "$workflow")" --repo "$GITHUB_REPOSITORY" || echo "❌ Invalid workflow"
    fi
done
```

## Getting Help

### 1. Documentation

- 📖 [User Guide](user-guide.md) - Usage patterns and examples
- ⚙️ [Configuration Options](configuration-options.md) - Complete configuration reference
- 🚀 [Setup Instructions](setup-instructions.md) - Installation and setup
- 🏗️ [Architecture Overview](architecture-overview.md) - System architecture

### 2. Community Support

- 💬 [GitHub Discussions](https://github.com/cmbrose/task-master-issues/discussions) - Community Q&A
- 🐛 [Issue Tracker](https://github.com/cmbrose/task-master-issues/issues) - Bug reports and feature requests
- 📚 [Wiki](https://github.com/cmbrose/task-master-issues/wiki) - Additional documentation

### 3. Debugging Information

When reporting issues, include:

```bash
# System information
npm run debug:system-info

# Configuration dump
npm run debug:config-dump

# Recent logs
npm run debug:logs --last=100

# Performance metrics
npm run debug:performance
```

### 4. Emergency Recovery

If the system is completely broken:

```bash
# Reset to defaults
npm run reset:config

# Clear all caches
npm run clear:all-caches

# Rebuild from scratch
npm run rebuild:clean

# Emergency recovery mode
npm run emergency:recover
```

### 5. Professional Support

For enterprise support:
- 📧 Email: support@taskmaster.dev
- 🎫 Support Portal: https://support.taskmaster.dev
- 📞 Phone: Available for enterprise customers

## Prevention Tips

### 1. Regular Maintenance

```bash
# Weekly health checks
npm run health:weekly

# Monthly performance reviews
npm run perf:monthly-report

# Quarterly configuration audits
npm run audit:quarterly
```

### 2. Monitoring Setup

```yaml
# Add to workflow for monitoring
- name: Health Check
  run: npm run test:smoke
  if: always()

- name: Performance Check
  run: npm run test:5min-prd
  if: github.event_name == 'schedule'
```

### 3. Best Practices

- ✅ Use specific action versions
- ✅ Test changes in staging environment
- ✅ Monitor workflow execution times
- ✅ Regular configuration validation
- ✅ Keep dependencies updated
- ✅ Use dry-run mode for testing
- ✅ Monitor GitHub API rate limits
- ✅ Backup configuration files