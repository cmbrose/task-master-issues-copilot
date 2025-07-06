# Configuration Options

This document provides comprehensive details on all configuration options available in Task Master Issues.

## Table of Contents

- [Workflow Configuration](#workflow-configuration)
- [Environment Variables](#environment-variables)
- [Taskmaster Configuration File](#taskmaster-configuration-file)
- [Advanced Configuration](#advanced-configuration)
- [Performance Tuning](#performance-tuning)
- [Security Configuration](#security-configuration)

## Workflow Configuration

### GitHub Actions Input Parameters

Configure the action in your workflow file:

```yaml
- name: Generate Issues from PRD
  uses: cmbrose/task-master-issues@main
  with:
    # Required Parameters
    github-token: ${{ secrets.GITHUB_TOKEN }}
    
    # Core Configuration
    prd-paths: 'docs/**/*.prd.md'           # File patterns for PRDs
    dry-run: 'false'                        # Preview mode without creating issues
    complexity-threshold: '6'               # Complexity threshold for breakdown
    
    # Issue Creation
    default-labels: 'taskmaster,auto-generated'  # Default labels for all issues
    label-prefix: 'tm-'                     # Prefix for generated labels
    milestone: 'Sprint 1'                   # Default milestone
    
    # Batch Processing
    batch-size: '15'                        # Items per batch
    max-concurrent: '5'                     # Maximum concurrent operations
    batch-delay: '1000'                     # Delay between batches (ms)
    
    # Advanced Options
    enable-checkpointing: 'true'            # Enable recovery checkpoints
    config-file: '.taskmaster/config.yml'  # Custom config file path
    debug: 'false'                          # Enable debug logging
```

### Input Parameter Details

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `github-token` | string | **Required** | GitHub token with repo permissions |
| `prd-paths` | string | `docs/**/*.prd.md` | Glob patterns for PRD files |
| `dry-run` | boolean | `false` | Run without creating actual issues |
| `complexity-threshold` | number | `6` | Threshold for automatic breakdown |
| `default-labels` | string | `taskmaster` | Comma-separated default labels |
| `label-prefix` | string | `''` | Prefix for generated labels |
| `milestone` | string | `''` | Default milestone for issues |
| `batch-size` | number | `15` | Items processed per batch |
| `max-concurrent` | number | `5` | Maximum concurrent operations |
| `batch-delay` | number | `1000` | Delay between batches (milliseconds) |
| `enable-checkpointing` | boolean | `true` | Enable recovery checkpoints |
| `config-file` | string | `.taskmaster/config.yml` | Custom configuration file |
| `debug` | boolean | `false` | Enable debug logging |

## Environment Variables

### Core Configuration

```bash
# GitHub Configuration
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
GITHUB_API_URL=https://api.github.com

# Taskmaster Core
TASKMASTER_DRY_RUN=false
COMPLEXITY_THRESHOLD=6
MAX_BATCH_SIZE=20
ENABLE_BATCH_PROCESSING=true

# Performance Configuration
BATCH_DELAY_MS=1000
MAX_RETRIES=3
TIMEOUT_MS=30000
MAX_CONCURRENT_REQUESTS=5

# Feature Flags
ENABLE_SUB_ISSUES=true
ENABLE_DEPENDENCY_TRACKING=true
ENABLE_AUTO_BLOCKING=true
ENABLE_CHECKPOINTING=true

# Logging Configuration
LOG_LEVEL=info
ENABLE_DEBUG_LOGS=false
ENABLE_STRUCTURED_LOGGING=true
LOG_OUTPUT_FORMAT=json
```

### Environment Variable Reference

#### GitHub API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | **Required** | GitHub personal access token |
| `GITHUB_OWNER` | Auto-detected | Repository owner |
| `GITHUB_REPO` | Auto-detected | Repository name |
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API base URL |

#### Performance Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BATCH_SIZE` | `15` | Default batch size for processing |
| `MAX_BATCH_SIZE` | `50` | Maximum allowed batch size |
| `BATCH_DELAY_MS` | `1000` | Delay between batch operations |
| `MAX_RETRIES` | `3` | Maximum retry attempts |
| `TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `MAX_CONCURRENT_REQUESTS` | `5` | Maximum concurrent API requests |

#### Feature Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_SUB_ISSUES` | `true` | Enable sub-issue creation |
| `ENABLE_DEPENDENCY_TRACKING` | `true` | Enable dependency management |
| `ENABLE_AUTO_BLOCKING` | `true` | Auto-block dependent issues |
| `ENABLE_CHECKPOINTING` | `true` | Enable recovery checkpoints |
| `ENABLE_CIRCUIT_BREAKER` | `true` | Enable circuit breaker pattern |

## Taskmaster Configuration File

Create `.taskmaster/config.yml` for advanced configuration:

```yaml
# Core Configuration
core:
  version: "1.0"
  mode: "production"  # development, staging, production
  timezone: "UTC"

# PRD Parsing Configuration
parsing:
  # File patterns to scan for PRDs
  prd_patterns:
    - "docs/**/*.prd.md"
    - "requirements/**/*.md"
    - "specs/**/*.specification.md"
  
  # Exclude patterns
  exclude_patterns:
    - "docs/archive/**"
    - "**/*.draft.md"
    - "**/template.md"
  
  # YAML frontmatter validation
  frontmatter:
    required_fields:
      - task_id
      - title
      - complexity
    optional_fields:
      - priority
      - labels
      - estimated_hours
      - dependencies
  
  # Complexity mapping
  complexity_mapping:
    1: "trivial"
    2-3: "low"
    4-6: "medium"
    7-8: "high"
    9-10: "epic"

# Issue Creation Configuration
issue_creation:
  # Default settings for all issues
  defaults:
    labels:
      - "taskmaster-generated"
      - "needs-triage"
    assignees: []
    milestone: null
    
  # Label management
  label_management:
    auto_create: true
    prefix: "tm-"
    color_scheme:
      complexity: "#0052CC"
      priority: "#FF5722"
      type: "#4CAF50"
  
  # Issue templates
  templates:
    epic:
      title_format: "[EPIC] {title}"
      description_template: |
        ## Epic Overview
        {description}
        
        ## Sub-Tasks
        {subtasks}
        
        ## Dependencies
        {dependencies}
    
    feature:
      title_format: "[FEATURE] {title}"
      description_template: |
        ## Feature Description
        {description}
        
        ## Implementation Details
        {implementation}
        
        ## Acceptance Criteria
        {acceptance_criteria}
    
    task:
      title_format: "{title}"
      description_template: |
        ## Task Description
        {description}
        
        ## Implementation Notes
        {notes}

# Dependency Management
dependency_management:
  # Automatic blocking/unblocking
  auto_blocking:
    enabled: true
    update_frequency: "*/10 * * * *"  # Every 10 minutes
    
  # Dependency resolution
  resolution:
    strict_mode: false  # Allow partial dependency resolution
    circular_detection: true
    max_depth: 10
    
  # Status monitoring
  monitoring:
    check_interval: 600  # 10 minutes
    batch_size: 50
    include_closed_issues: false

# Performance Configuration
performance:
  # Batch processing
  batch_processing:
    default_size: 15
    max_size: 50
    adaptive_sizing: true
    min_size: 5
    
  # Concurrency control
  concurrency:
    max_concurrent: 5
    queue_size: 100
    timeout_ms: 30000
    
  # Rate limiting
  rate_limiting:
    requests_per_minute: 60
    burst_limit: 10
    backoff_strategy: "exponential"
    
  # Circuit breaker
  circuit_breaker:
    enabled: true
    failure_threshold: 5
    recovery_timeout: 60000
    half_open_max_calls: 3

# Error Handling
error_handling:
  # Retry configuration
  retry:
    max_attempts: 3
    base_delay: 1000
    max_delay: 30000
    backoff_multiplier: 2
    
  # Recovery strategies
  recovery:
    enable_checkpointing: true
    checkpoint_interval: 10
    auto_recovery: true
    recovery_timeout: 300000
    
  # Error categorization
  categorization:
    rate_limit_retry: true
    timeout_retry: true
    network_error_retry: true
    auth_error_retry: false

# Logging Configuration
logging:
  # Log levels
  level: "info"  # debug, info, warn, error, critical
  
  # Output configuration
  output:
    console: true
    file: false
    structured: true
    format: "json"
    
  # Log categories
  categories:
    system: true
    github_api: true
    performance: true
    error_recovery: true
    batch_processing: true
    
  # Performance logging
  performance_tracking:
    enabled: true
    include_memory: true
    include_timing: true
    threshold_ms: 1000

# Security Configuration
security:
  # Token validation
  token_validation:
    enabled: true
    required_scopes:
      - "repo"
      - "issues:write"
    
  # Input sanitization
  input_sanitization:
    enabled: true
    max_title_length: 256
    max_description_length: 65536
    allowed_html_tags: []
    
  # Audit logging
  audit:
    enabled: true
    log_api_calls: true
    log_issue_creation: true
    log_config_changes: true

# Testing Configuration
testing:
  # Mock configuration for tests
  mocks:
    github_api: true
    file_system: true
    network: true
    
  # Test data
  test_data:
    generate_large_datasets: false
    use_real_api: false
    cleanup_test_issues: true
    
  # Performance testing
  performance_tests:
    enable_5min_test: true
    enable_load_tests: true
    enable_stress_tests: false
```

## Advanced Configuration

### Multi-Repository Setup

Configure for multiple repositories:

```yaml
# .taskmaster/multi-repo.yml
repositories:
  - name: "main-app"
    owner: "myorg"
    prd_patterns:
      - "docs/features/**/*.prd.md"
    
  - name: "api-service"
    owner: "myorg"
    prd_patterns:
      - "specs/**/*.md"
      
  - name: "frontend"
    owner: "myorg"
    prd_patterns:
      - "requirements/**/*.prd.md"

cross_repo_dependencies:
  enabled: true
  link_format: "{owner}/{repo}#{issue_number}"
```

### Custom Label Schemes

```yaml
label_schemes:
  priority:
    critical: 
      color: "#FF0000"
      description: "Critical priority task"
    high:
      color: "#FF8C00"
      description: "High priority task"
    medium:
      color: "#FFD700"
      description: "Medium priority task"
    low:
      color: "#90EE90"
      description: "Low priority task"
      
  complexity:
    epic:
      color: "#8B0000"
      description: "Epic-level complexity (9-10)"
    high:
      color: "#FF4500"
      description: "High complexity (7-8)"
    medium:
      color: "#FFA500"
      description: "Medium complexity (4-6)"
    low:
      color: "#32CD32"
      description: "Low complexity (1-3)"
      
  type:
    backend:
      color: "#0066CC"
      description: "Backend development task"
    frontend:
      color: "#9933CC"
      description: "Frontend development task"
    database:
      color: "#CC6600"
      description: "Database-related task"
    infrastructure:
      color: "#666666"
      description: "Infrastructure/DevOps task"
```

## Performance Tuning

### Optimization Settings

```yaml
# High-performance configuration
performance_optimized:
  batch_processing:
    default_size: 25
    adaptive_sizing: true
    parallel_processing: true
    
  caching:
    enabled: true
    ttl: 3600  # 1 hour
    max_entries: 1000
    
  compression:
    enabled: true
    algorithm: "gzip"
    level: 6

# Memory-optimized configuration
memory_optimized:
  batch_processing:
    default_size: 10
    stream_processing: true
    garbage_collection: "aggressive"
    
  caching:
    enabled: false
    
  limits:
    max_concurrent: 3
    memory_limit: "256MB"
```

### Resource Limits

```yaml
resource_limits:
  memory:
    max_heap_size: "512MB"
    gc_threshold: "256MB"
    
  cpu:
    max_cpu_percent: 80
    throttle_threshold: 90
    
  network:
    max_connections: 10
    connection_timeout: 30000
    read_timeout: 60000
    
  disk:
    temp_directory: "/tmp/taskmaster"
    max_temp_size: "100MB"
    cleanup_interval: 3600
```

## Security Configuration

### Authentication & Authorization

```yaml
security:
  authentication:
    token_validation:
      enabled: true
      check_scopes: true
      required_scopes:
        - "repo"
        - "issues:write"
        - "pull_requests:write"
    
    token_rotation:
      enabled: false
      rotation_interval: "24h"
      
  authorization:
    rbac:
      enabled: false
      roles:
        admin: ["create", "update", "delete"]
        user: ["create", "update"]
        readonly: ["read"]
        
  encryption:
    at_rest: false
    in_transit: true
    algorithm: "AES-256"
    
  audit:
    enabled: true
    log_level: "info"
    include_payloads: false
    retention_days: 90
```

### Data Privacy

```yaml
privacy:
  data_collection:
    telemetry: false
    analytics: false
    error_reporting: true
    
  data_retention:
    logs: "30d"
    cache: "1d"
    artifacts: "7d"
    
  sensitive_data:
    masking: true
    patterns:
      - "token"
      - "key"
      - "secret"
      - "password"
```

## Configuration Validation

Validate your configuration:

```bash
# Validate configuration file
npm run config:validate

# Test configuration with dry-run
npm run test:config -- --dry-run

# Generate configuration documentation
npm run config:docs
```

## Configuration Examples

See the `examples/` directory for complete configuration examples:

- [`examples/basic-config.yml`](../examples/basic-config.yml) - Basic setup
- [`examples/enterprise-config.yml`](../examples/enterprise-config.yml) - Enterprise features
- [`examples/performance-config.yml`](../examples/performance-config.yml) - Performance optimized
- [`examples/security-config.yml`](../examples/security-config.yml) - Security hardened

## Migration Guide

### From v1.0 to v2.0

Key changes in configuration format:

```yaml
# Old format (v1.0)
complexity_threshold: 6
batch_size: 15

# New format (v2.0)
core:
  complexity_threshold: 6
performance:
  batch_processing:
    default_size: 15
```

Use the migration tool:

```bash
npm run migrate:config -- --from=1.0 --to=2.0
```

## Troubleshooting Configuration

### Common Issues

1. **Invalid YAML syntax**
   ```bash
   npm run config:validate
   ```

2. **Missing required fields**
   ```bash
   npm run config:check-required
   ```

3. **Performance issues**
   ```bash
   npm run config:performance-check
   ```

4. **Permission errors**
   ```bash
   npm run config:permissions-check
   ```

For more help, see the [Troubleshooting Guide](troubleshooting-guide.md).