#!/usr/bin/env ts-node

/**
 * Test Preview Comment Generation
 * 
 * Tests the markdown formatter and PR comment functionality with sample data.
 */

import { formatTaskGraphMarkdown, formatCompactTaskGraphSummary, TaskGraph } from '../scripts/markdown-formatter';

// Sample task graph for testing
const sampleTaskGraph: TaskGraph = {
  tasks: [
    {
      id: 1,
      title: "Setup Repository Structure",
      description: "Initialize the GitHub Action template repository with proper directory structure, configuration files, and basic workflow scaffolding",
      details: "Create .github/workflows/ directory structure, initialize action.yml metadata file with inputs, setup composite action structure with required permissions, and create initial README with usage instructions",
      testStrategy: "Verify repository structure matches expected layout, validate action.yml syntax with GitHub Actions CLI, confirm all required inputs are properly defined with correct defaults",
      priority: "high",
      dependencies: [],
      status: "pending",
      complexityScore: 6,
      isBlocked: false,
      subtasks: [
        {
          id: 1,
          title: "Create directory structure",
          description: "Set up the basic directory structure for the GitHub Actions repository",
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
        }
      ]
    },
    {
      id: 2,
      title: "Implement Core Functionality",
      description: "Build the main action logic with task parsing, issue creation, and GitHub API integration",
      priority: "critical",
      dependencies: [1],
      status: "pending",
      complexityScore: 9,
      isBlocked: true,
      blockedBy: ["Task #1"]
    },
    {
      id: 3,
      title: "Add Testing Framework",
      description: "Create comprehensive test suite for all functionality",
      priority: "medium",
      dependencies: [2],
      status: "completed",
      complexityScore: 5,
      isBlocked: false
    }
  ],
  metadata: {
    totalTasks: 5,
    leafTasks: 3,
    hierarchyDepth: 2,
    generationTimestamp: new Date().toISOString(),
    complexityThreshold: 40,
    maxDepth: 3
  }
};

console.log('🧪 Testing Preview Comment Generation\n');

// Test 1: Full markdown formatting
console.log('📝 Test 1: Full Markdown Formatting');
console.log('=====================================');
const fullMarkdown = formatTaskGraphMarkdown(sampleTaskGraph, {
  includeDetails: true,
  includeTestStrategy: true,
  showComplexity: true,
  showBlockedStatus: true,
  useCollapsibleSections: true,
  includeSummary: true
});
console.log(fullMarkdown);
console.log('\n');

// Test 2: Compact summary
console.log('📝 Test 2: Compact Summary');
console.log('===========================');
const compactSummary = formatCompactTaskGraphSummary(sampleTaskGraph);
console.log(compactSummary);
console.log('\n');

// Test 3: Minimal formatting options
console.log('📝 Test 3: Minimal Formatting');
console.log('==============================');
const minimalMarkdown = formatTaskGraphMarkdown(sampleTaskGraph, {
  includeDetails: false,
  includeTestStrategy: false,
  showComplexity: true,
  showBlockedStatus: true,
  useCollapsibleSections: false,
  includeSummary: false
});
console.log(minimalMarkdown);
console.log('\n');

// Test 4: Large task graph simulation
console.log('📝 Test 4: Large Task Graph');
console.log('============================');
const largeTaskGraph: TaskGraph = {
  tasks: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    title: `Task ${i + 1}`,
    description: `Description for task ${i + 1}`,
    priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
    status: i < 5 ? 'completed' : 'pending',
    complexityScore: Math.floor(Math.random() * 10) + 1,
    isBlocked: i > 15,
    dependencies: i > 0 ? [Math.max(1, i - 1)] : []
  })),
  metadata: {
    totalTasks: 20,
    leafTasks: 10,
    hierarchyDepth: 1,
    generationTimestamp: new Date().toISOString(),
    complexityThreshold: 40,
    maxDepth: 3
  }
};

const largeGraphSummary = formatCompactTaskGraphSummary(largeTaskGraph);
console.log(largeGraphSummary);
console.log('\n');

console.log('✅ All tests completed successfully!');
console.log('\n📊 Test Results:');
console.log(`- Full markdown length: ${fullMarkdown.length} characters`);
console.log(`- Compact summary length: ${compactSummary.length} characters`);
console.log(`- Minimal markdown length: ${minimalMarkdown.length} characters`);
console.log(`- Large graph summary length: ${largeGraphSummary.length} characters`);