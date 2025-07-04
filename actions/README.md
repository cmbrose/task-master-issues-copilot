# Taskmaster GitHub Actions

This directory contains the GitHub Actions for the Taskmaster project.

## Actions

### taskmaster-generate
Generates task graphs and GitHub issues from PRD (Product Requirements Document) files.

**Triggers:** Push events to PRD files matching the configured glob pattern
**Key Features:**
- Parses PRD files using Taskmaster CLI
- Creates hierarchical GitHub issues with dependencies
- Uploads task graph artifacts
- Configurable complexity thresholds and recursion depth

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
- Removes "blocked" labels when dependencies are resolved
- Supports both webhook and full scan modes
- Maintains dependency chain integrity

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