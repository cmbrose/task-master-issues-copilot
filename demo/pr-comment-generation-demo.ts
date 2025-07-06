#!/usr/bin/env ts-node

/**
 * Demo PR Comment Generation
 * 
 * Demonstrates the complete PR comment functionality with a sample task graph.
 * This simulates what would happen during a dry-run on a PR.
 */

import { formatTaskGraphMarkdown, TaskGraph } from '../scripts/markdown-formatter';
import { PrCommentManager } from '../scripts/pr-comment-manager';

// Sample task graph from the real tasks.json 
const sampleTaskGraph: TaskGraph = {
  tasks: [
    {
      id: 1,
      title: "Setup Repository Structure and Configuration",
      description: "Initialize the GitHub Action template repository with proper directory structure, configuration files, and basic workflow scaffolding",
      details: "Create .github/workflows/ directory structure, initialize action.yml metadata file with inputs (complexity-threshold: 40, max-depth: 3, prd-path-glob: docs/**.prd.md, breakdown-max-depth: 2, taskmaster-args), setup composite action structure with required permissions (issues: write, contents: read), and create initial README with usage instructions",
      testStrategy: "Verify repository structure matches expected layout, validate action.yml syntax with GitHub Actions CLI, confirm all required inputs are properly defined with correct defaults",
      priority: "high",
      dependencies: [],
      status: "pending",
      complexityScore: 7,
      isBlocked: false,
      subtasks: [
        {
          id: 1,
          title: "Create directory structure",
          description: "Set up the basic directory structure for the GitHub Actions repository including necessary folders and placeholder files",
          dependencies: [],
          status: "pending",
          complexityScore: 3,
          isBlocked: false
        },
        {
          id: 2,
          title: "Setup action.yml metadata",
          description: "Create and configure the action.yml file with proper metadata, inputs, outputs, and basic action definition",
          dependencies: [1],
          status: "pending",
          complexityScore: 4,
          isBlocked: true,
          blockedBy: ["Task #1.1"]
        },
        {
          id: 3,
          title: "Configure composite action",
          description: "Implement the composite action configuration with step definitions and shell commands",
          dependencies: [2],
          status: "pending",
          complexityScore: 5,
          isBlocked: true,
          blockedBy: ["Task #1.2"]
        }
      ]
    },
    {
      id: 2,
      title: "Implement Taskmaster CLI Integration",
      description: "Build integration layer for downloading, configuring, and executing Taskmaster CLI with proper error handling and retry logic",
      priority: "critical",
      dependencies: [1],
      status: "pending",
      complexityScore: 8,
      isBlocked: true,
      blockedBy: ["Task #1"]
    },
    {
      id: 3,
      title: "Create GitHub API Client",
      description: "Develop robust GitHub API integration with rate limiting, error handling, and idempotency features",
      priority: "high",
      dependencies: [1],
      status: "pending",
      complexityScore: 9,
      isBlocked: true,
      blockedBy: ["Task #1"]
    },
    {
      id: 4,
      title: "Add Issue Creation Logic",
      description: "Implement task-to-issue conversion with proper linking, dependency management, and label generation",
      priority: "medium",
      dependencies: [2, 3],
      status: "pending",
      complexityScore: 6,
      isBlocked: true,
      blockedBy: ["Task #2", "Task #3"]
    },
    {
      id: 5,
      title: "Testing and Documentation",
      description: "Create comprehensive test suite and documentation for the action",
      priority: "medium",
      dependencies: [4],
      status: "pending",
      complexityScore: 4,
      isBlocked: true,
      blockedBy: ["Task #4"]
    }
  ],
  metadata: {
    totalTasks: 8,
    leafTasks: 4,
    hierarchyDepth: 2,
    generationTimestamp: new Date().toISOString(),
    complexityThreshold: 40,
    maxDepth: 3
  }
};

console.log('🚀 Demo: PR Comment Generation\n');

// Show the markdown that would be posted
console.log('📝 Generated Markdown Preview:');
console.log('=' .repeat(80));

const previewMarkdown = formatTaskGraphMarkdown(sampleTaskGraph, {
  includeDetails: true,
  includeTestStrategy: true,
  showComplexity: true,
  showBlockedStatus: true,
  useCollapsibleSections: true,
  includeSummary: true
});

console.log(previewMarkdown);

console.log('=' .repeat(80));
console.log('\n📊 Markdown Statistics:');
console.log(`- Length: ${previewMarkdown.length} characters`);
console.log(`- Lines: ${previewMarkdown.split('\n').length}`);
console.log(`- Tasks: ${sampleTaskGraph.tasks.length} main tasks`);
console.log(`- Subtasks: ${sampleTaskGraph.tasks.reduce((sum, task) => sum + (task.subtasks?.length || 0), 0)}`);
console.log(`- Total items: ${sampleTaskGraph.metadata?.totalTasks || 'unknown'}`);

console.log('\n🔍 Preview Features Demonstrated:');
console.log('- ✅ Task hierarchy with collapsible sections');
console.log('- ✅ Complexity scores with visual indicators');
console.log('- ✅ Blocked/unblocked status tracking');
console.log('- ✅ Dependency relationships');
console.log('- ✅ Priority levels with icons');
console.log('- ✅ Progress statistics');
console.log('- ✅ Generation metadata');
console.log('- ✅ Legend for all symbols');

console.log('\n💡 This markdown would be posted as a comment on the PR with:');
console.log('- Automatic replacement of existing preview comments');
console.log('- Smart formatting based on task graph size');
console.log('- Collapsible sections for better readability');
console.log('- Visual indicators for quick status understanding');

console.log('\n✅ Demo completed successfully!');
console.log('\n📋 Next Steps:');
console.log('- This functionality is integrated into the taskmaster-generate action');
console.log('- It runs automatically on PR events in dry-run mode');
console.log('- Comments are posted/updated via GitHub API');
console.log('- Only one preview comment exists per PR (automatic replacement)');