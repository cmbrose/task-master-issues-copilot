# Task Master Issues

A GitHub Action template for automated task planning and issue management based on Product Requirements Documents (PRDs).

## Overview

This repository provides GitHub Actions that automatically generate hierarchical task graphs from PRD files, create corresponding GitHub issues, and manage dependencies between tasks.

## Directory Structure

```
├── actions/                    # GitHub Actions implementations
│   ├── taskmaster-generate/   # Generate issues from PRDs
│   ├── taskmaster-breakdown/  # Break down issues via commands
│   └── taskmaster-watcher/    # Watch and update dependencies
├── scripts/                   # Shared utility scripts
├── docs/                      # Documentation and PRD files
├── .github/                   # GitHub workflows and configuration
└── .taskmaster/              # Taskmaster CLI configuration
```

## Actions

### 🚀 taskmaster-generate
- **Purpose**: Automatically generate GitHub issues from PRD files
- **Trigger**: Push events to PRD files (configurable glob pattern)
- **Features**: Hierarchical issue creation, dependency linking, artifact generation

### 🔄 taskmaster-breakdown  
- **Purpose**: Break down large issues into manageable sub-tasks
- **Trigger**: Issue comments with `/breakdown` command
- **Features**: On-demand decomposition, configurable depth and thresholds

### 👁️ taskmaster-watcher
- **Purpose**: Monitor dependencies and update issue status
- **Trigger**: Issue closed events and scheduled cron jobs
- **Features**: Automatic label management, dependency chain resolution

## Usage

See the individual action directories for detailed usage instructions and examples.

## Development

This project uses TypeScript for action development. Each action is independently buildable and deployable.