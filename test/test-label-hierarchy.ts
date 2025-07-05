#!/usr/bin/env ts-node

/**
 * Test script for enhanced label and hierarchy management
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock the create-issues module functionality for testing
interface Task {
  id: number;
  title: string;
  description: string;
  details?: string;
  testStrategy?: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Task[];
  requiredBy?: Task[];
}

// Helper to generate comprehensive labels for issues
function generateIssueLabels(task: Task, parentTask?: Task, complexityScore?: number): string[] {
  const labels = ['taskmaster'];
  
  // Priority labels
  if (task.priority) {
    labels.push(`priority:${task.priority.toLowerCase()}`);
  }
  
  // Status labels
  if (task.status) {
    labels.push(`status:${task.status.toLowerCase()}`);
  }
  
  // Task type labels
  if (parentTask) {
    labels.push('subtask');
    labels.push(`parent:${parentTask.id}`);
  } else {
    labels.push('main-task');
  }
  
  // Complexity labels
  if (complexityScore !== undefined) {
    if (complexityScore >= 8) {
      labels.push('complexity:high');
    } else if (complexityScore >= 5) {
      labels.push('complexity:medium');
    } else {
      labels.push('complexity:low');
    }
  }
  
  // Dependency status labels
  if (task.dependencies && task.dependencies.length > 0) {
    labels.push('has-dependencies');
  }
  
  // Hierarchy labels
  if (task.subtasks && task.subtasks.length > 0) {
    labels.push('has-subtasks');
  }
  
  return labels;
}

// Helper to create enhanced issue title with priority ordering
function buildIssueTitle(task: Task, parentTask?: Task): string {
  let title: string;
  
  // Priority prefixes for ordering (high priority tasks appear first)
  const priorityPrefix = task.priority ? 
    (task.priority.toLowerCase() === 'high' ? '[🔴 HIGH] ' : 
     task.priority.toLowerCase() === 'medium' ? '[🟡 MED] ' : 
     task.priority.toLowerCase() === 'low' ? '[🟢 LOW] ' : '') : '';
  
  if (typeof parentTask !== 'undefined' && 'id' in task) {
    title = `${priorityPrefix}[${parentTask.id}.${task.id}] ${task.title}`;
  } else {
    title = `${priorityPrefix}[${task.id}] ${task.title}`;
  }
  
  return title;
}

// Mock issue interface for dependency testing
interface MockIssue {
  id: number;
  number: number;
  state: 'open' | 'closed';
}

// Helper to update issue labels based on dependency status
function updateDependencyLabels(task: Task, dependencyIssues: MockIssue[] | undefined): string[] {
  const additionalLabels: string[] = [];
  
  if (!dependencyIssues || dependencyIssues.length === 0) {
    return additionalLabels;
  }
  
  const openDependencies = dependencyIssues.filter(issue => issue.state === 'open');
  
  if (openDependencies.length > 0) {
    additionalLabels.push('blocked');
    additionalLabels.push(`blocked-by:${openDependencies.length}`);
  } else {
    // All dependencies are closed, task is ready
    additionalLabels.push('ready');
  }
  
  return additionalLabels;
}

function runTests(): void {
  console.log('🧪 Testing Enhanced Label and Hierarchy Management\n');
  
  let passed = 0;
  let total = 0;
  
  const test = (name: string, condition: boolean) => {
    total++;
    if (condition) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
    }
  };
  
  // Test 1: Basic labeling for main task
  const mainTask: Task = {
    id: 1,
    title: 'Setup Repository',
    description: 'Initialize the repository',
    priority: 'high',
    status: 'pending',
    dependencies: [2, 3]
  };
  
  const mainLabels = generateIssueLabels(mainTask, undefined, 7);
  test('Main task has correct labels', 
    mainLabels.includes('taskmaster') &&
    mainLabels.includes('priority:high') &&
    mainLabels.includes('status:pending') &&
    mainLabels.includes('main-task') &&
    mainLabels.includes('complexity:medium') &&
    mainLabels.includes('has-dependencies')
  );
  
  // Test 2: Subtask labeling
  const subtask: Task = {
    id: 2,
    title: 'Create directory structure',
    description: 'Set up directories',
    priority: 'medium',
    status: 'pending'
  };
  
  const subLabels = generateIssueLabels(subtask, mainTask, 4);
  test('Subtask has correct labels',
    subLabels.includes('subtask') &&
    subLabels.includes('parent:1') &&
    subLabels.includes('priority:medium') &&
    subLabels.includes('complexity:low')
  );
  
  // Test 3: Title generation with priority
  const highPriorityTitle = buildIssueTitle(mainTask);
  test('High priority title has correct prefix',
    highPriorityTitle.includes('[🔴 HIGH]')
  );
  
  const subtaskTitle = buildIssueTitle(subtask, mainTask);
  test('Subtask title has correct format',
    subtaskTitle.includes('[1.2]') && subtaskTitle.includes('[🟡 MED]')
  );
  
  // Test 4: Dependency status labeling
  const blockedDeps: MockIssue[] = [
    { id: 1, number: 100, state: 'open' },
    { id: 2, number: 101, state: 'closed' }
  ];
  
  const blockedLabels = updateDependencyLabels(mainTask, blockedDeps);
  test('Blocked task has correct dependency labels',
    blockedLabels.includes('blocked') &&
    blockedLabels.includes('blocked-by:1')
  );
  
  const readyDeps: MockIssue[] = [
    { id: 1, number: 100, state: 'closed' },
    { id: 2, number: 101, state: 'closed' }
  ];
  
  const readyLabels = updateDependencyLabels(mainTask, readyDeps);
  test('Ready task has correct dependency labels',
    readyLabels.includes('ready') &&
    !readyLabels.includes('blocked')
  );
  
  // Test 5: Complex hierarchy task
  const complexTask: Task = {
    id: 5,
    title: 'Complex Feature',
    description: 'A complex feature with subtasks',
    priority: 'low',
    status: 'in-progress',
    subtasks: [{
      id: 1,
      title: 'Subtask 1',
      description: 'First subtask'
    }]
  };
  
  const complexLabels = generateIssueLabels(complexTask, undefined, 9);
  test('Complex task has all appropriate labels',
    complexLabels.includes('has-subtasks') &&
    complexLabels.includes('complexity:high') &&
    complexLabels.includes('priority:low') &&
    complexLabels.includes('status:in-progress')
  );
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed (${Math.round(passed/total*100)}% success rate)`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Enhanced labeling system is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}