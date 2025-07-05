# Taskmaster GitHub Actions

This directory contains the GitHub Actions for the Taskmaster project.

## Actions

### taskmaster-generate
Generates task graphs and GitHub issues from PRD (Product Requirements Document) files.

**Triggers:** Push events to PRD files matching the configured glob pattern
**Key Features:**
- Parses PRD files using Taskmaster CLI
- Creates hierarchical GitHub issues with dependencies
- Uploads task graph artifacts with structured metadata
- Configurable complexity thresholds and recursion depth
- Comprehensive artifact metadata including task counts, hierarchy depth, and file statistics

**Artifact Metadata:**
- `prd_version` - Version extracted from PRD file
- `generation_timestamp` - ISO timestamp of generation
- `complexity_threshold` - Task complexity threshold used
- `max_depth` - Maximum recursion depth used  
- `total_tasks` - Total count of all tasks and subtasks
- `leaf_tasks_count` - Count of tasks without subtasks
- `task_hierarchy_depth` - Maximum depth of task hierarchy

### taskmaster-breakdown
Provides on-demand breakdown of GitHub issues into sub-tasks via slash commands.

**Triggers:** Issue comments starting with `/breakdown`
**Key Features:**
- Parses breakdown command arguments
- Creates sub-issues linked to parent
- Supports depth and threshold overrides
- Idempotent operation

### taskmaster-watcher
Monitors issue changes and automatically updates dependency status.

**Triggers:** Issue closed events and scheduled cron jobs
**Key Features:**
- Automatically removes "blocked" labels when dependencies are resolved
- Adds "ready" labels when all dependencies are completed  
- Supports both webhook and full scan modes
- Maintains dependency chain integrity
- Comprehensive error handling and logging

**Operation Modes:**
- `webhook` mode: Processes single issue closed events for real-time updates
- `full` mode: Scans all open issues for batch dependency status updates

**Label Management:**
- `blocked` - Issue has unresolved dependencies
- `blocked-by:N` - Shows count of blocking dependencies
- `ready` - All dependencies resolved, issue ready for work

## Directory Structure

```
actions/
├── taskmaster-generate/
│   ├── action.yml          # Action definition
│   ├── src/               # TypeScript source code
│   └── dist/              # Compiled JavaScript (generated)
├── taskmaster-breakdown/
│   ├── action.yml          # Action definition
│   ├── src/               # TypeScript source code
│   └── dist/              # Compiled JavaScript (generated)
├── taskmaster-watcher/
│   ├── action.yml          # Action definition
│   ├── src/               # TypeScript source code
│   └── dist/              # Compiled JavaScript (generated)
└── README.md              # This file
```

## Usage

Each action can be used independently in GitHub workflows. See the individual action.yml files for input/output specifications and usage examples.

## Development

All actions are built using TypeScript and compiled to JavaScript for execution. The source code is in the `src/` directories and compiled output goes to `dist/` directories.

### Building Actions

To build all actions:
```bash
npm run build:actions
```

To build individual actions:
```bash
npm run build:generate    # Build taskmaster-generate
npm run build:breakdown   # Build taskmaster-breakdown  
npm run build:watcher     # Build taskmaster-watcher
```

### Development Workflow

1. Make changes to TypeScript files in `actions/*/src/`
2. Run `npm run build:actions` to compile changes
3. Commit both source and compiled `dist/` files
4. The CI workflow will verify builds are up to date

### Dependencies

The actions use the following key dependencies:
- `@actions/core` - GitHub Actions toolkit core
- `@actions/github` - GitHub API integration
- `@vercel/ncc` - Bundler for creating single-file distributions

All dependencies are bundled into the `dist/index.js` files for distribution.