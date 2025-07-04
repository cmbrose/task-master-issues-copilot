# Configuration Management System

The Taskmaster configuration management system provides centralized, validated, and flexible configuration handling across all actions with support for multiple configuration sources and environment-specific overrides.

## Features

- **📁 Configuration Files**: JSON and YAML support
- **🌍 Environment Variables**: GitHub Actions and custom environment variables
- **✅ Validation & Sanitization**: Built-in parameter validation and value sanitization
- **📦 Default Values**: Comprehensive default configuration
- **🔄 Priority System**: Clear precedence order for configuration sources
- **🎯 Presets**: Pre-configured setups for common scenarios
- **💾 Persistence**: Save and load configuration states

## Configuration Priority

Configuration values are resolved in the following priority order (highest to lowest):

1. **Action Inputs** (highest priority)
2. **Environment Variables**
3. **Configuration Files**
4. **Default Values** (lowest priority)

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `complexityThreshold` | number | `40` | Maximum complexity threshold for task breakdown (1-100) |
| `maxDepth` | number | `3` | Maximum depth for automatic task recursion (1-10) |
| `prdPathGlob` | string | `"docs/**.prd.md"` | Path glob pattern for PRD files |
| `breakdownMaxDepth` | number | `2` | Maximum depth for breakdown recursion (1-5) |
| `scanMode` | string | `"webhook"` | Scan mode: `"webhook"` or `"full"` |
| `taskmasterVersion` | string | `"1.0.0"` | Version of Taskmaster CLI to use |
| `taskmasterBaseUrl` | string | `"https://github.com/taskmaster-ai/taskmaster/releases/download"` | Base URL for CLI downloads |
| `taskmasterArgs` | string | `""` | Additional CLI arguments |
| `forceDownload` | boolean | `false` | Force re-download of CLI binary |
| `githubToken` | string | `""` | GitHub token for API access |
| `actionMode` | string | `"full"` | Action mode: `"generate"`, `"breakdown"`, `"watcher"`, or `"full"` |

## Configuration Files

### Supported File Names

The system automatically searches for configuration files in the following order:

- `.taskmaster.json`
- `.taskmaster.yml`
- `.taskmaster.yaml`
- `taskmaster.config.json`
- `taskmaster.config.yml`
- `taskmaster.config.yaml`

### YAML Example

```yaml
taskmaster:
  complexityThreshold: 45
  maxDepth: 3
  prdPathGlob: "docs/**/*.prd.md"
  breakdownMaxDepth: 2
  scanMode: "webhook"

environments:
  development:
    complexityThreshold: 30
    scanMode: "full"
    forceDownload: true
  
  production:
    complexityThreshold: 50
    scanMode: "webhook"
```

### JSON Example

```json
{
  "taskmaster": {
    "complexityThreshold": 45,
    "maxDepth": 3,
    "prdPathGlob": "docs/**/*.prd.md",
    "breakdownMaxDepth": 2,
    "scanMode": "webhook"
  },
  "environments": {
    "development": {
      "complexityThreshold": 30,
      "scanMode": "full",
      "forceDownload": true
    }
  }
}
```

## Environment Variables

### GitHub Actions Convention

Following GitHub Actions convention, environment variables use the `INPUT_` prefix:

```yaml
env:
  INPUT_COMPLEXITY_THRESHOLD: '50'
  INPUT_MAX_DEPTH: '2'
  INPUT_PRD_PATH_GLOB: 'docs/requirements/**.prd.md'
  INPUT_SCAN_MODE: 'full'
  INPUT_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Custom Environment Variables

Alternative environment variables with `TM_` prefix:

```bash
export TM_COMPLEXITY_THRESHOLD=50
export TM_MAX_DEPTH=2
export TM_PRD_PATH_GLOB="docs/requirements/**.prd.md"
export TM_SCAN_MODE=full
export TM_GITHUB_TOKEN="${{ secrets.GITHUB_TOKEN }}"
```

### Supported Environment Variable Names

| Parameter | GitHub Actions | Custom | GitHub Token |
|-----------|----------------|--------|--------------|
| `complexityThreshold` | `INPUT_COMPLEXITY-THRESHOLD`<br>`INPUT_COMPLEXITY_THRESHOLD` | `TM_COMPLEXITY_THRESHOLD` | |
| `maxDepth` | `INPUT_MAX-DEPTH`<br>`INPUT_MAX_DEPTH` | `TM_MAX_DEPTH` | |
| `prdPathGlob` | `INPUT_PRD-PATH-GLOB`<br>`INPUT_PRD_PATH_GLOB` | `TM_PRD_PATH_GLOB` | |
| `breakdownMaxDepth` | `INPUT_BREAKDOWN-MAX-DEPTH`<br>`INPUT_BREAKDOWN_MAX_DEPTH` | `TM_BREAKDOWN_MAX_DEPTH` | |
| `scanMode` | `INPUT_SCAN-MODE`<br>`INPUT_SCAN_MODE` | `TM_SCAN_MODE` | |
| `taskmasterVersion` | `INPUT_TASKMASTER-VERSION`<br>`INPUT_TASKMASTER_VERSION` | `TM_TASKMASTER_VERSION` | |
| `taskmasterBaseUrl` | `INPUT_TASKMASTER-BASE-URL`<br>`INPUT_TASKMASTER_BASE_URL` | `TM_TASKMASTER_BASE_URL` | |
| `taskmasterArgs` | `INPUT_TASKMASTER-ARGS`<br>`INPUT_TASKMASTER_ARGS` | `TM_TASKMASTER_ARGS` | |
| `forceDownload` | `INPUT_FORCE-DOWNLOAD`<br>`INPUT_FORCE_DOWNLOAD` | `TM_FORCE_DOWNLOAD` | |
| `githubToken` | `INPUT_GITHUB-TOKEN`<br>`INPUT_GITHUB_TOKEN` | `TM_GITHUB_TOKEN` | `GITHUB_TOKEN` |
| `actionMode` | `INPUT_ACTION-MODE`<br>`INPUT_ACTION_MODE` | `TM_ACTION_MODE` | |

## Configuration Presets

The system includes built-in presets for common scenarios:

### Development Preset
```typescript
{
  complexityThreshold: 30,
  maxDepth: 2,
  scanMode: 'full',
  forceDownload: true
}
```

### Production Preset
```typescript
{
  complexityThreshold: 40,
  maxDepth: 3,
  scanMode: 'webhook',
  forceDownload: false
}
```

### Testing Preset
```typescript
{
  complexityThreshold: 20,
  maxDepth: 1,
  scanMode: 'webhook',
  forceDownload: true
}
```

## Validation and Sanitization

All configuration parameters are automatically validated and sanitized:

### Validation Rules

- **Numbers**: Range validation (e.g., complexity threshold: 1-100)
- **Strings**: Non-empty validation for required fields
- **Enums**: Valid option checking (e.g., scanMode: webhook|full)
- **URLs**: Basic URL format validation
- **Versions**: Semantic version format validation

### Sanitization

- **Numbers**: Clamped to valid ranges
- **Strings**: Trimmed whitespace
- **URLs**: Trailing slash removal
- **Booleans**: String to boolean conversion

## Usage Examples

### Programmatic Usage

```typescript
import { loadConfig, createPreset, validateConfig } from '@scripts/config-management';

// Load configuration with validation
const config = loadConfig({
  validate: true,
  baseDir: process.cwd()
});

// Apply development preset
const devConfig = loadConfig({}, createPreset('development'));

// Manual validation
const validation = validateConfig(someConfig);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### GitHub Actions Usage

```yaml
- name: Run Taskmaster
  uses: cmbrose/task-master-issues@v1
  with:
    complexity-threshold: '45'
    max-depth: '3'
    prd-path-glob: 'docs/**.prd.md'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Configuration File + Action Inputs

Create `.taskmaster.yml`:
```yaml
taskmaster:
  complexityThreshold: 35  # Default for all environments
  prdPathGlob: "docs/requirements/**.prd.md"
```

Override in action:
```yaml
- name: Run Taskmaster
  uses: cmbrose/task-master-issues@v1
  with:
    complexity-threshold: '50'  # Overrides file setting
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Error Handling

The configuration system provides detailed error messages for:

- **Invalid Values**: Clear validation error messages
- **Missing Required Fields**: Identification of missing required parameters
- **File Format Errors**: JSON/YAML parsing error details
- **Type Conversion Errors**: Help with data type issues

Example error output:
```
Configuration validation failed: 
- complexityThreshold: Complexity threshold must be a number between 1 and 100
- scanMode: Scan mode must be either "webhook" or "full"
```

## Migration from Legacy Configuration

If you're upgrading from the previous configuration system:

1. **Action Inputs**: No changes required - all existing inputs work
2. **Environment Variables**: Existing `INPUT_*` variables continue to work
3. **New Features**: Add configuration files for project-wide defaults
4. **Validation**: Review settings - values are now validated and may be sanitized

## Configuration Persistence

Save configuration for reuse:

```typescript
import { saveConfig } from '@scripts/config-management';

const config = {
  complexityThreshold: 45,
  maxDepth: 3,
  scanMode: 'webhook'
};

// Save as JSON
saveConfig(config, '.taskmaster.json');

// Save as YAML
saveConfig(config, '.taskmaster.yml');
```

## Best Practices

1. **Use Configuration Files**: Set project defaults in `.taskmaster.yml`
2. **Environment-Specific Settings**: Use GitHub Actions inputs for deployment-specific overrides
3. **Version Control**: Commit configuration files to share settings across team
4. **Sensitive Data**: Always use secrets for `githubToken`, never in config files
5. **Validation**: Enable validation in production workflows
6. **Documentation**: Document custom configurations for your team

## Troubleshooting

### Common Issues

1. **Configuration not found**: Check file names and locations
2. **Validation errors**: Review parameter ranges and types
3. **Environment variables ignored**: Check naming convention
4. **Path resolution**: Ensure relative paths are correct

### Debug Configuration Loading

Set debug environment variable:
```bash
export DEBUG=taskmaster:config
```

This will log the configuration loading process for troubleshooting.