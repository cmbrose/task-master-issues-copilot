#!/usr/bin/env ts-node

/**
 * Test script to validate dependency tracking logic
 * 
 * Tests the enhanced IssueDependencyTracker with cycle detection
 * and dependency resolution order functionality.
 */

import { IssueDependencyTracker } from '../demo/enhanced-issue-management';

// Mock GitHub issue interface
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
}

function runTests(): void {
  console.log('🧪 Testing Dependency Tracking Logic\n');

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

  const tracker = new IssueDependencyTracker();

  // Test 1: Basic dependency graph building
  const basicIssues: GitHubIssue[] = [
    {
      number: 1,
      title: 'Task 1',
      state: 'open',
      labels: [],
      body: `---
id: 1
dependencies: []
---
## Description
Root task`
    },
    {
      number: 2,
      title: 'Task 2',
      state: 'open',
      labels: [],
      body: `---
id: 2
dependencies: [1]
---
## Description
Depends on task 1`
    }
  ];

  const graph = tracker.buildDependencyGraph(basicIssues);
  test('Basic dependency graph building',
    graph.size === 2 &&
    (graph.get(1)?.dependencies.length || 0) === 0 &&
    (graph.get(2)?.dependencies.length || 0) === 1 &&
    Boolean(graph.get(1)?.dependents.includes(2))
  );

  // Test 2: Cycle detection - no cycles
  const cycles = tracker.detectCycles(basicIssues);
  test('No cycles detected in acyclic graph', cycles.length === 0);

  // Test 3: Dependency resolution order - no cycles
  const resolutionOrder = tracker.getDependencyResolutionOrder(basicIssues);
  test('Dependency resolution order for acyclic graph',
    !resolutionOrder.hasCycles &&
    resolutionOrder.order.length === 2 &&
    resolutionOrder.order[0] === 1 &&
    resolutionOrder.order[1] === 2
  );

  // Test 4: Cycle detection - with cycles
  const cyclicIssues: GitHubIssue[] = [
    {
      number: 10,
      title: 'Task A',
      state: 'open',
      labels: [],
      body: `---
id: 10
dependencies: [12]
---
## Description
Task A depends on Task C`
    },
    {
      number: 11,
      title: 'Task B',
      state: 'open',
      labels: [],
      body: `---
id: 11
dependencies: [10]
---
## Description
Task B depends on Task A`
    },
    {
      number: 12,
      title: 'Task C',
      state: 'open',
      labels: [],
      body: `---
id: 12
dependencies: [11]
---
## Description
Task C depends on Task B`
    }
  ];

  const cyclicCycles = tracker.detectCycles(cyclicIssues);
  test('Cycles detected in cyclic graph', cyclicCycles.length > 0);

  // Test 5: Dependency resolution order - with cycles
  const cyclicResolutionOrder = tracker.getDependencyResolutionOrder(cyclicIssues);
  test('Dependency resolution order fails for cyclic graph',
    cyclicResolutionOrder.hasCycles &&
    cyclicResolutionOrder.cycles.length > 0 &&
    cyclicResolutionOrder.order.length === 0
  );

  // Test 6: Complex dependency chain
  const complexIssues: GitHubIssue[] = [
    {
      number: 20,
      title: 'Root Task',
      state: 'open',
      labels: [],
      body: `---
id: 20
dependencies: []
---`
    },
    {
      number: 21,
      title: 'Mid Task 1',
      state: 'open',
      labels: [],
      body: `---
id: 21
dependencies: [20]
---`
    },
    {
      number: 22,
      title: 'Mid Task 2',
      state: 'open',
      labels: [],
      body: `---
id: 22
dependencies: [20]
---`
    },
    {
      number: 23,
      title: 'Final Task',
      state: 'open',
      labels: [],
      body: `---
id: 23
dependencies: [21, 22]
---`
    }
  ];

  const complexResolutionOrder = tracker.getDependencyResolutionOrder(complexIssues);
  test('Complex dependency resolution order',
    !complexResolutionOrder.hasCycles &&
    complexResolutionOrder.order.length === 4 &&
    complexResolutionOrder.order[0] === 20 &&
    complexResolutionOrder.order.includes(21) &&
    complexResolutionOrder.order.includes(22) &&
    complexResolutionOrder.order[3] === 23
  );

  // Test 7: Critical path calculation
  const criticalPath = tracker.getCriticalPath(complexIssues);
  test('Critical path calculation',
    criticalPath.length >= 3 &&
    criticalPath[0] === 20 &&
    criticalPath[criticalPath.length - 1] === 23
  );

  console.log(`\n📊 Test Results: ${passed}/${total} passed (${Math.round(passed/total*100)}% success rate)`);

  if (passed === total) {
    console.log('\n🎉 All dependency tracking logic tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Check the implementation.');
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

export { runTests };