#!/usr/bin/env ts-node

/**
 * Test script for blocked status management functionality
 */

import { parseIssueBody, type ParsedDependency } from '../scripts/issue-parser';

/**
 * Mock issue interface for testing
 */
interface MockIssue {
  number: number;
  state: 'open' | 'closed';
  body: string;
  labels?: Array<{ name: string }>;
}

/**
 * Helper to update issue labels based on dependency status (from watcher action)
 */
function updateDependencyLabels(dependencies: ParsedDependency[]): string[] {
  const additionalLabels: string[] = [];
  
  if (dependencies.length === 0) {
    return additionalLabels;
  }
  
  const openDependencies = dependencies.filter(dep => !dep.completed);
  
  if (openDependencies.length > 0) {
    additionalLabels.push('blocked');
    additionalLabels.push(`blocked-by:${openDependencies.length}`);
  } else {
    // All dependencies are closed, task is ready
    additionalLabels.push('ready');
  }
  
  return additionalLabels;
}

/**
 * Find issues that can be unblocked by closing a specific issue
 */
function findUnblockableIssues(closedIssueNumber: number, issues: MockIssue[]): MockIssue[] {
  const unblockable: MockIssue[] = [];
  
  for (const issue of issues) {
    if (issue.state === 'closed') continue;
    
    try {
      const parsed = parseIssueBody(issue.body);
      const dependencies = parsed.dependencies;
      
      // Check if this issue depends on the closed issue
      const dependsOnClosed = dependencies.some(dep => dep.issueNumber === closedIssueNumber);
      if (!dependsOnClosed) continue;
      
      // Check if closing this dependency would unblock the issue
      const remainingBlockers = dependencies.filter(dep => 
        dep.issueNumber !== closedIssueNumber && !dep.completed
      );
      
      if (remainingBlockers.length === 0) {
        unblockable.push(issue);
      }
    } catch (error) {
      console.warn(`Failed to parse issue #${issue.number}: ${error}`);
    }
  }
  
  return unblockable;
}

/**
 * Test helper function
 */
function test(description: string, condition: boolean): void {
  if (condition) {
    console.log(`✅ ${description}`);
  } else {
    console.log(`❌ ${description}`);
    process.exit(1);
  }
}

function runTests(): void {
  console.log('🧪 Testing Blocked Status Management');
  
  // Test 1: Basic dependency label generation
  const noDeps: ParsedDependency[] = [];
  const noDepLabels = updateDependencyLabels(noDeps);
  test('No dependencies returns empty labels', noDepLabels.length === 0);
  
  const blockedDeps: ParsedDependency[] = [
    { issueNumber: 100, completed: false },
    { issueNumber: 101, completed: true }
  ];
  const blockedLabels = updateDependencyLabels(blockedDeps);
  test('Partially completed dependencies returns blocked labels',
    blockedLabels.includes('blocked') && blockedLabels.includes('blocked-by:1')
  );
  
  const readyDeps: ParsedDependency[] = [
    { issueNumber: 100, completed: true },
    { issueNumber: 101, completed: true }
  ];
  const readyLabels = updateDependencyLabels(readyDeps);
  test('All completed dependencies returns ready label',
    readyLabels.includes('ready') && !readyLabels.some(l => l.startsWith('blocked'))
  );
  
  // Test 2: Finding unblockable issues
  const mockIssues: MockIssue[] = [
    {
      number: 200,
      state: 'open',
      body: `## Description
Task that depends on multiple issues

## Dependencies

- [ ] #100
- [x] #101

<!-- created-by-taskmaster-script -->`
    },
    {
      number: 201,
      state: 'open', 
      body: `## Description
Task that depends only on issue 100

## Dependencies

- [ ] #100

<!-- created-by-taskmaster-script -->`
    },
    {
      number: 202,
      state: 'open',
      body: `## Description
Task with no dependencies

<!-- created-by-taskmaster-script -->`
    },
    {
      number: 203,
      state: 'open',
      body: `## Description
Task that depends on different issues

## Dependencies

- [ ] #105
- [ ] #106

<!-- created-by-taskmaster-script -->`
    }
  ];
  
  // Closing issue #100 should unblock both issues that depend on it
  // Issue #200: depends on #100 (would be resolved) and #101 (already resolved) -> unblocked  
  // Issue #201: depends only on #100 (would be resolved) -> unblocked
  const unblockable = findUnblockableIssues(100, mockIssues);
  
  test('Closing issue #100 unblocks both issues #200 and #201', 
    unblockable.length === 2 && 
    unblockable.some(i => i.number === 200) && 
    unblockable.some(i => i.number === 201)
  );
  
  // Test 3: Issue body parsing for dependencies
  const issueWithDeps = mockIssues[0];
  const parsed = parseIssueBody(issueWithDeps.body);
  test('Parse dependencies correctly from issue body',
    parsed.dependencies.length === 2 &&
    parsed.dependencies.some(dep => dep.issueNumber === 100 && !dep.completed) &&
    parsed.dependencies.some(dep => dep.issueNumber === 101 && dep.completed)
  );
  
  // Test 4: Label generation for parsed dependencies  
  const parsedLabels = updateDependencyLabels(parsed.dependencies);
  test('Generate correct labels for parsed dependencies',
    parsedLabels.includes('blocked') && parsedLabels.includes('blocked-by:1')
  );
  
  // Test 5: Edge case - closing non-dependency issue
  const unblockableNone = findUnblockableIssues(999, mockIssues);
  test('Closing non-dependency issue unblocks no issues',
    unblockableNone.length === 0
  );
  
  console.log('\n🎉 All blocked status management tests passed!');
  console.log('\nSummary:');
  console.log('✅ Dependency label generation');
  console.log('✅ Unblockable issue detection');
  console.log('✅ Issue body parsing');
  console.log('✅ Label updates for dependencies');
  console.log('✅ Edge case handling');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { updateDependencyLabels, findUnblockableIssues };