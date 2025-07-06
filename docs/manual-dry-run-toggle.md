# Manual Dry-Run Toggle Feature

This document describes the enhanced manual dry-run toggle functionality that allows users to control dry-run mode via GitHub UI.

## Overview

The manual dry-run toggle feature extends the existing automatic dry-run functionality by allowing users to explicitly enable dry-run mode when manually triggering workflows through the GitHub Actions UI.

## Features

### Automatic Dry-Run Detection
- **Pull Requests**: Automatically enables dry-run mode for all pull request events
- **Push Events**: Runs normally (dry-run disabled) for push events to main/master branches  
- **Other Events**: Run normally by default

### Manual Override
- **Workflow Dispatch**: Users can manually enable dry-run mode via checkbox in GitHub UI
- **Default Behavior**: Manual dry-run defaults to `false` for security
- **UI Control**: Simple boolean toggle in the "Run workflow" interface

## Configuration

### Workflow Input Definition
Both `taskmaster.yml` and `taskmaster-generate.yml` now include:

```yaml
workflow_dispatch:
  inputs:
    dry-run:
      description: 'Enable dry-run mode (generate task graph without creating issues)'
      required: false
      default: false
      type: boolean
```

### Dry-Run Detection Logic
The workflows use enhanced logic to determine dry-run mode:

```yaml
# For taskmaster-generate.yml
if [[ "${{ github.event_name }}" == "pull_request" ]]; then
  echo "🎯 Running in DRY-RUN mode - no issues will be created"
  echo "DRY_RUN=true" >> $GITHUB_ENV
elif [[ "${{ github.event_name }}" == "workflow_dispatch" && "${{ inputs.dry-run }}" == "true" ]]; then
  echo "🎯 Manual DRY-RUN mode enabled - no issues will be created"
  echo "DRY_RUN=true" >> $GITHUB_ENV
else
  echo "DRY_RUN=false" >> $GITHUB_ENV
fi
```

## Usage

### Manual Workflow Execution
1. Navigate to GitHub Actions tab
2. Select "Taskmaster Generate" or "Taskmaster Complete Workflow"
3. Click "Run workflow"
4. Check the "Enable dry-run mode" checkbox
5. Configure other parameters as needed
6. Click "Run workflow"

### Result
When manual dry-run is enabled:
- ✅ Task graph is generated and analyzed
- ✅ Preview comment is posted (for PR context)
- ✅ Artifacts are uploaded for review
- ✅ Complete logging and statistics
- 🚫 No GitHub issues are created or modified
- 🚫 No repository state changes

## Benefits

### Safety
- **Default Off**: Manual dry-run defaults to `false` to prevent accidental use
- **Explicit Control**: Users must consciously enable dry-run mode
- **Clear Feedback**: Logs clearly indicate when manual dry-run is active

### Flexibility
- **Testing**: Test workflow changes without creating issues
- **Preview**: Preview task graph generation for new PRD files
- **Validation**: Validate configuration changes safely
- **Demonstration**: Show workflow functionality without side effects

### Consistency
- **Unified Interface**: Same dry-run behavior across all trigger types
- **Predictable Logic**: Clear precedence rules for dry-run determination
- **Comprehensive Logging**: All parameters logged including dry-run status

## Dry-Run Precedence

The dry-run mode determination follows this precedence:

1. **Pull Request Events**: Always enable dry-run (highest priority)
2. **Manual Workflow Dispatch**: Use user's checkbox selection
3. **All Other Events**: Disable dry-run (default behavior)

## Testing

### Automated Tests
- `test-dry-run-toggle.sh`: Validates toggle functionality
- `test-manual-dry-run-toggle.sh`: Tests manual input configuration
- `test-pull-request-trigger.sh`: Verifies PR dry-run behavior

### Manual Testing
```bash
# Test manual dry-run input configuration
npm run test:manual-dry-run-toggle

# Test overall toggle functionality  
npm run test:dry-run-toggle

# Test PR trigger behavior
npm run test:pull-request-trigger
```

## Examples

### Manual Dry-Run Enabled
```
🚀 Taskmaster Generate triggered by: workflow_dispatch
👤 Triggered manually by: username
⚙️ Parameters:
  • PRD path glob: docs/**.prd.md
  • Complexity threshold: 40
  • Max depth: 3
  • Taskmaster version: 1.0.0
  • Force download: false
  • Max artifacts count: 10
  • Retention days: 30
  • Dry-run mode: true
  
🎯 Manual DRY-RUN mode enabled - no issues will be created
```

### Automatic PR Dry-Run
```
🚀 Taskmaster Generate triggered by: pull_request
🔀 Pull request #123: Add new feature PRD
👤 Opened by: developer
📄 Base branch: main
📄 Head branch: feature/new-feature

🎯 Running in DRY-RUN mode - no issues will be created
```

## Migration

### Existing Workflows
No migration required - the feature is additive and maintains backward compatibility:
- Existing automatic dry-run behavior unchanged
- New manual toggle available immediately
- Default values preserve existing behavior

### Action Inputs
The new `dry-run` input is optional and defaults to `false`, so existing workflow calls continue to work without modification.

## Security Considerations

### Safe Defaults
- **Default False**: Manual dry-run defaults to disabled
- **No Auto-Enable**: Manual workflows don't automatically enable dry-run
- **Explicit Intent**: Users must consciously choose dry-run mode

### Input Validation
- **Boolean Type**: Enforced boolean type prevents injection
- **Required False**: Input is optional to maintain compatibility
- **Clear Description**: Users understand the impact of enabling dry-run

## Future Enhancements

Potential improvements for future versions:
- **Configuration File**: Support dry-run settings in `.taskmaster/config.json`
- **Repository Defaults**: Allow repositories to set default dry-run behavior
- **Conditional Logic**: More sophisticated dry-run triggers based on file changes
- **Integration**: Dry-run integration with external CI/CD systems