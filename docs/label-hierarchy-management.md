# Label and Hierarchy Management

This document describes the enhanced label and hierarchy management system for Taskmaster GitHub Issues, providing comprehensive labeling, parent-child relationships, dependency mapping, and priority ordering.

## Overview

The enhanced system automatically applies intelligent labels to GitHub issues based on task metadata, establishes clear parent-child relationships, tracks dependency status, and implements priority-based ordering for optimal project management.

## Features

### 🏷️ Comprehensive Labeling System

Issues are automatically labeled with multiple categories to provide rich metadata:

#### Base Labels
- `taskmaster` - Applied to all Taskmaster-generated issues

#### Priority Labels  
- `priority:high` - High priority tasks (🔴 HIGH in title)
- `priority:medium` - Medium priority tasks (🟡 MED in title)  
- `priority:low` - Low priority tasks (🟢 LOW in title)

#### Status Labels
- `status:pending` - Tasks not yet started
- `status:in-progress` - Tasks currently being worked on
- `status:completed` - Finished tasks
- `status:blocked` - Tasks waiting on dependencies

#### Task Type Labels
- `main-task` - Root-level tasks
- `subtask` - Child tasks with parent dependencies
- `parent:X` - Indicates this is a subtask of task X

#### Complexity Labels
- `complexity:high` - Tasks with complexity score ≥ 8
- `complexity:medium` - Tasks with complexity score 5-7
- `complexity:low` - Tasks with complexity score < 5

#### Hierarchy Labels
- `has-subtasks` - Tasks containing subtasks
- `has-dependencies` - Tasks with prerequisite dependencies

#### Dependency Status Labels
- `blocked` - Tasks with open dependencies
- `blocked-by:X` - Tasks blocked by X open dependencies
- `ready` - Tasks with all dependencies closed

### 🔗 Parent-Child Relationships

The system establishes clear hierarchical relationships:

```
[🔴 HIGH] [1] Setup Repository Structure
├── [🟡 MED] [1.1] Create directory structure  
├── [🟡 MED] [1.2] Setup action.yml metadata
└── [🟢 LOW] [1.3] Configure composite action
```

**Features:**
- Automatic parent-child linking via GitHub's sub-issue API
- Visual hierarchy indicators in issue titles
- Parent task references in subtask metadata
- Consistent labeling inheritance from parent tasks

### 📊 Dependency Mapping

Smart dependency tracking with automatic status updates:

**Dependency States:**
- `ready` - All dependencies completed, task can start
- `blocked` - One or more dependencies still open
- `blocked-by:N` - Specific count of blocking dependencies

**Automatic Updates:**
- Labels update when dependencies close
- Status changes propagate to dependent tasks
- Real-time dependency chain resolution

### ⚡ Priority Ordering

Visual priority indicators ensure important tasks are easily identified:

**Title Prefixes:**
- `[🔴 HIGH]` - Critical tasks requiring immediate attention
- `[🟡 MED]` - Important tasks with medium priority  
- `[🟢 LOW]` - Nice-to-have tasks with low priority

**Benefits:**
- Quick visual scanning of issue lists
- Natural sorting by priority level
- Clear communication of task importance

## Usage Examples

### Creating Issues with Enhanced Labels

```bash
# Set environment variables
export GITHUB_TOKEN="your-github-token"
export GITHUB_OWNER="your-org"
export GITHUB_REPO="your-repo"

# Generate issues with enhanced labeling
npm run start
```

**Sample Output:**
```
Created issue: [🔴 HIGH] [1] Setup Repository Structure (#100)
  Labels: taskmaster, priority:high, status:pending, main-task, complexity:medium, has-subtasks

Created issue: [🟡 MED] [1.1] Create directory structure (#101)  
  Labels: taskmaster, priority:medium, status:pending, subtask, parent:1, complexity:low

Created issue: [🟢 LOW] [1.2] Setup documentation (#102)
  Labels: taskmaster, priority:low, status:pending, subtask, parent:1, complexity:low, blocked, blocked-by:1
```

### Label-Based Queries

Find issues by specific criteria:

```bash
# High priority tasks
label:"priority:high"

# Blocked tasks  
label:"blocked"

# Tasks ready to start
label:"ready"

# Subtasks of a specific parent
label:"parent:1"

# Complex tasks requiring attention
label:"complexity:high"
```

### Hierarchy Views

GitHub Issues automatically groups by labels, enabling views like:

- **By Priority:** See all high/medium/low priority tasks
- **By Status:** Track pending/in-progress/completed work
- **By Complexity:** Focus on high-complexity tasks needing expert attention
- **By Dependencies:** Identify bottlenecks and ready work

## Configuration

### Task Data Format

The system reads from `.taskmaster/tasks/tasks.json`:

```json
{
  "master": {
    "tasks": [
      {
        "id": 1,
        "title": "Setup Repository",
        "description": "Initialize repository structure",
        "priority": "high",
        "status": "pending", 
        "dependencies": [2, 3],
        "subtasks": [
          {
            "id": 1,
            "title": "Create directories",
            "priority": "medium",
            "dependencies": []
          }
        ]
      }
    ]
  }
}
```

### Complexity Scoring

Complexity scores from `.taskmaster/reports/task-complexity-report.json`:

```json
{
  "complexityAnalysis": [
    {
      "taskId": "1",
      "complexityScore": 7
    },
    {
      "taskId": "1.1", 
      "complexityScore": 3
    }
  ]
}
```

## Advanced Features

### Dynamic Label Updates

Labels automatically update when:
- Dependencies are closed (removes `blocked`, adds `ready`)
- Task status changes (updates `status:*` labels)
- Complexity analysis is rerun (updates `complexity:*` labels)

### Batch Operations

Process multiple issues efficiently:
- Bulk label application across task hierarchies
- Dependency chain resolution in single API calls
- Optimized GitHub API usage with rate limiting

### Integration with GitHub Features

Leverages GitHub's native functionality:
- Issue templates with pre-populated labels
- Automated project board updates based on labels
- GitHub Actions triggers on label changes
- Native search and filtering capabilities

## Best Practices

### Label Hygiene
- Use consistent label naming conventions
- Regularly audit and clean up unused labels
- Document custom label meanings for team

### Dependency Management
- Keep dependency chains shallow when possible
- Regularly review and resolve blocked tasks
- Use dependency labels to identify bottlenecks

### Priority Management
- Assign priorities consistently across team
- Review and adjust priorities during planning
- Use priority labels for sprint planning

## Testing

Run the comprehensive test suite:

```bash
# Test labeling logic
npm run test:labels

# Test specific components
npx ts-node test/test-label-hierarchy.ts
```

**Test Coverage:**
- ✅ Label generation for all task types
- ✅ Priority ordering in titles
- ✅ Dependency status tracking
- ✅ Hierarchy relationship mapping
- ✅ Complex task handling
- ✅ Edge cases and error conditions

## Troubleshooting

### Common Issues

**Labels not appearing:**
- Verify GitHub token has `issues:write` permission
- Check task data format in `tasks.json`
- Review console logs for API errors

**Incorrect dependency status:**
- Ensure all referenced tasks exist
- Verify dependency IDs match task IDs
- Check GitHub API rate limits

**Missing hierarchy relationships:**
- Confirm sub-issue API is available
- Review parent task ID references
- Check issue creation order

### Debug Mode

Enable detailed logging:

```bash
export DEBUG=true
npm run start
```

This provides verbose output of:
- Label generation decisions
- API calls and responses  
- Dependency resolution logic
- Error details and recovery attempts

## API Reference

### Core Functions

#### `generateIssueLabels(task, parentTask?, complexityScore?): string[]`
Generates comprehensive labels for a task based on metadata.

#### `buildIssueTitle(task, parentTask?): string`  
Creates priority-ordered issue titles with visual indicators.

#### `updateDependencyLabels(task, dependencyIssues?): string[]`
Determines dependency status labels based on current issue states.

### Configuration Options

The system respects configuration from:
- Environment variables (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`)
- Task metadata (priority, status, complexity)
- Complexity reports (automatically loaded)

### Error Handling

Robust error handling includes:
- Graceful API failure recovery
- Missing data fallbacks
- Rate limit management
- Detailed error logging

---

*For more information, see the [Taskmaster Documentation](../README.md) or [GitHub API Integration Guide](./github-api-integration.md).*