#!/usr/bin/env ts-node

/**
 * Test suite for dependency graph functionality
 */

import { DependencyGraph, createDependencyGraphFromTasks, CycleDetectionResult, ResolutionOrder } from '../scripts/dependency-graph';

function runDependencyGraphTests(): void {
  console.log('🧪 Testing Dependency Graph Data Structure\n');
  
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

  // Test 1: Basic graph construction
  const graph = new DependencyGraph();
  graph.addNode(1, []);
  graph.addNode(2, [1]);
  graph.addNode(3, [1, 2]);
  
  test('Graph construction - nodes added correctly', 
    graph.getNode(1) !== undefined &&
    graph.getNode(2) !== undefined &&
    graph.getNode(3) !== undefined
  );
  
  const node3 = graph.getNode(3)!;
  test('Dependencies set correctly',
    node3.dependencies.includes(1) && node3.dependencies.includes(2)
  );
  
  const node1 = graph.getNode(1)!;
  test('Dependents calculated correctly',
    node1.dependents.includes(2) && node1.dependents.includes(3)
  );

  // Test 2: Cycle detection - no cycles
  const noCycleResult = graph.detectCycles();
  test('No cycle detection works',
    !noCycleResult.hasCycle
  );

  // Test 3: Cycle detection - with cycles
  const cyclicGraph = new DependencyGraph();
  cyclicGraph.addNode(1, [2]);
  cyclicGraph.addNode(2, [3]);
  cyclicGraph.addNode(3, [1]); // Creates cycle: 1->2->3->1
  
  const cycleResult = cyclicGraph.detectCycles();
  test('Cycle detection finds cycles',
    cycleResult.hasCycle && cycleResult.cycle !== undefined
  );
  
  test('Cycle path is correct',
    cycleResult.cycle !== undefined && 
    cycleResult.cycle.length >= 3 &&
    cycleResult.cycle.includes(1) &&
    cycleResult.cycle.includes(2) &&
    cycleResult.cycle.includes(3)
  );

  // Test 4: Topological sort - valid ordering
  const sortGraph = new DependencyGraph();
  sortGraph.addNode(1, []); // No dependencies
  sortGraph.addNode(2, [1]); // Depends on 1
  sortGraph.addNode(3, [1]); // Depends on 1
  sortGraph.addNode(4, [2, 3]); // Depends on 2 and 3
  
  let resolutionOrder: ResolutionOrder;
  try {
    resolutionOrder = sortGraph.getResolutionOrder();
    test('Topological sort succeeds', true);
  } catch (e) {
    test('Topological sort succeeds', false);
    console.log(`Error: ${e}`);
    resolutionOrder = { order: [], levels: [] };
  }
  
  if (resolutionOrder.order.length > 0) {
    const order = resolutionOrder.order;
    test('Node 1 comes before node 2',
      order.indexOf(1) < order.indexOf(2)
    );
    
    test('Node 1 comes before node 3',
      order.indexOf(1) < order.indexOf(3)
    );
    
    test('Nodes 2 and 3 come before node 4',
      order.indexOf(2) < order.indexOf(4) &&
      order.indexOf(3) < order.indexOf(4)
    );
    
    test('All nodes included in resolution order',
      order.length === 4 &&
      order.includes(1) && order.includes(2) && order.includes(3) && order.includes(4)
    );
    
    test('Levels are structured correctly',
      resolutionOrder.levels.length > 0 &&
      resolutionOrder.levels[0].includes(1) // Node 1 should be in first level
    );
  }

  // Test 5: Topological sort - cyclic graph throws error
  let cyclicSortThrows = false;
  try {
    cyclicGraph.getResolutionOrder();
  } catch (e) {
    cyclicSortThrows = true;
  }
  
  test('Topological sort throws on cyclic graph', cyclicSortThrows);

  // Test 6: Ready nodes detection
  const readyGraph = new DependencyGraph();
  readyGraph.addNode(1, []);
  readyGraph.addNode(2, [1]);
  readyGraph.addNode(3, [1]);
  readyGraph.addNode(4, [2, 3]);
  
  const initialReady = readyGraph.getReadyNodes();
  test('Initially ready nodes detected correctly',
    initialReady.length === 1 && initialReady.includes(1)
  );
  
  const afterNode1 = readyGraph.getReadyNodes(new Set([1]));
  test('Ready nodes after completing node 1',
    afterNode1.length === 2 && afterNode1.includes(2) && afterNode1.includes(3)
  );
  
  const afterNodes123 = readyGraph.getReadyNodes(new Set([1, 2, 3]));
  test('Ready nodes after completing nodes 1, 2, 3',
    afterNodes123.length === 1 && afterNodes123.includes(4)
  );

  // Test 7: Transitive dependencies
  const transGraph = new DependencyGraph();
  transGraph.addNode(1, []);
  transGraph.addNode(2, [1]);
  transGraph.addNode(3, [2]);
  transGraph.addNode(4, [3]);
  
  const transitiveDeps = transGraph.getTransitiveDependencies(4);
  test('Transitive dependencies calculated correctly',
    transitiveDeps.includes(1) && transitiveDeps.includes(2) && transitiveDeps.includes(3)
  );
  
  const transitiveDependents = transGraph.getTransitiveDependents(1);
  test('Transitive dependents calculated correctly',
    transitiveDependents.includes(2) && transitiveDependents.includes(3) && transitiveDependents.includes(4)
  );

  // Test 8: Graph creation from tasks
  const tasks = [
    { id: 1, dependencies: [] },
    { id: 2, dependencies: [1] },
    { id: 3, dependencies: [1, 2] }
  ];
  
  const taskGraph = createDependencyGraphFromTasks(tasks);
  test('Graph created from tasks',
    taskGraph.getNode(1) !== undefined &&
    taskGraph.getNode(2) !== undefined &&
    taskGraph.getNode(3) !== undefined
  );
  
  const taskNode3 = taskGraph.getNode(3)!;
  test('Task dependencies preserved',
    taskNode3.dependencies.includes(1) && taskNode3.dependencies.includes(2)
  );

  // Test 9: Node removal
  const removeGraph = new DependencyGraph();
  removeGraph.addNode(1, []);
  removeGraph.addNode(2, [1]);
  removeGraph.addNode(3, [2]);
  
  removeGraph.removeNode(2);
  
  test('Node removed from graph',
    removeGraph.getNode(2) === undefined
  );
  
  const node1AfterRemoval = removeGraph.getNode(1)!;
  const node3AfterRemoval = removeGraph.getNode(3)!;
  
  test('Dependencies updated after node removal',
    !node1AfterRemoval.dependents.includes(2) &&
    !node3AfterRemoval.dependencies.includes(2)
  );

  // Test 10: Complex dependency scenario
  const complexGraph = new DependencyGraph();
  // Simulate a realistic task dependency scenario
  complexGraph.addNode(1, []); // Setup
  complexGraph.addNode(2, []); // Design
  complexGraph.addNode(3, [1, 2]); // Implementation depends on setup and design
  complexGraph.addNode(4, [3]); // Testing depends on implementation
  complexGraph.addNode(5, [3]); // Documentation depends on implementation
  complexGraph.addNode(6, [4, 5]); // Release depends on testing and documentation
  
  const complexOrder = complexGraph.getResolutionOrder();
  test('Complex scenario resolution order is valid',
    complexOrder.order.length === 6 &&
    // Setup and Design should come first
    (complexOrder.order.indexOf(1) < complexOrder.order.indexOf(3)) &&
    (complexOrder.order.indexOf(2) < complexOrder.order.indexOf(3)) &&
    // Implementation before testing and docs
    (complexOrder.order.indexOf(3) < complexOrder.order.indexOf(4)) &&
    (complexOrder.order.indexOf(3) < complexOrder.order.indexOf(5)) &&
    // Testing and docs before release
    (complexOrder.order.indexOf(4) < complexOrder.order.indexOf(6)) &&
    (complexOrder.order.indexOf(5) < complexOrder.order.indexOf(6))
  );
  
  test('Complex scenario has multiple levels',
    complexOrder.levels.length >= 3 // At least 3 levels of dependencies
  );
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed (${Math.round(passed/total*100)}% success rate)`);
  
  if (passed === total) {
    console.log('\n🎉 All dependency graph tests passed! The graph data structure is working correctly.');
  } else {
    console.log(`\n❌ ${total - passed} test(s) failed. Please review the implementation.`);
    process.exit(1);
  }
}

// Example usage demonstration
function demonstrateUsage(): void {
  console.log('\n🚀 Dependency Graph Usage Example\n');
  
  const tasks = [
    { id: 1, title: 'Setup Repository' },
    { id: 2, title: 'API Integration', dependencies: [1] },
    { id: 3, title: 'YAML Parsing', dependencies: [1] },
    { id: 4, title: 'Dependency Tracking', dependencies: [2, 3] },
    { id: 5, title: 'Testing', dependencies: [4] },
    { id: 6, title: 'Documentation', dependencies: [4] }
  ];
  
  console.log('Tasks:');
  tasks.forEach(task => {
    const deps = task.dependencies ? `deps: [${task.dependencies.join(', ')}]` : 'no dependencies';
    console.log(`  ${task.id}: ${task.title} (${deps})`);
  });
  
  const graph = createDependencyGraphFromTasks(tasks);
  
  // Check for cycles
  const cycleResult = graph.detectCycles();
  console.log(`\nCycle Detection: ${cycleResult.hasCycle ? '❌ Cycle found!' : '✅ No cycles'}`);
  
  // Get resolution order
  try {
    const resolution = graph.getResolutionOrder();
    console.log('\nResolution Order:');
    console.log(`  Sequential: ${resolution.order.join(' → ')}`);
    
    console.log('\nBy Levels (can be done in parallel):');
    resolution.levels.forEach((level, index) => {
      console.log(`  Level ${index + 1}: ${level.join(', ')}`);
    });
    
    console.log('\nReady to start:', graph.getReadyNodes().join(', '));
    
  } catch (e) {
    console.log(`\n❌ Error getting resolution order: ${e}`);
  }
}

if (require.main === module) {
  runDependencyGraphTests();
  demonstrateUsage();
}

export { runDependencyGraphTests };