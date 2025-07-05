#!/usr/bin/env ts-node

/**
 * Dependency Graph Integration Demo
 * 
 * This demonstrates how the dependency graph functionality integrates
 * with the existing taskmaster issue creation workflow.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DependencyGraph, createDependencyGraphFromTasks, CycleDetectionResult } from '../scripts/dependency-graph';

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

interface TaskmasterJson {
  master: {
    tasks: Task[];
    metadata: any;
  };
}

function demonstrateDependencyTracking(): void {
  console.log('🚀 Dependency Tracking Logic Demo');
  console.log('====================================\n');

  // Load sample tasks
  const sampleTasksPath = path.join(__dirname, 'sample-tasks.json');
  const raw = fs.readFileSync(sampleTasksPath, 'utf-8');
  const data: TaskmasterJson = JSON.parse(raw);
  const tasks = data.master.tasks;

  console.log('📋 Loaded Tasks:');
  tasks.forEach(task => {
    const deps = task.dependencies && task.dependencies.length > 0 
      ? `dependencies: [${task.dependencies.join(', ')}]` 
      : 'no dependencies';
    console.log(`  ${task.id}: ${task.title} (${deps})`);
  });

  console.log('\n🔍 Analyzing Dependency Graph...');

  // Create dependency graph
  const graph = createDependencyGraphFromTasks(tasks);

  // 1. Detect cycles
  const cycleResult = graph.detectCycles();
  if (cycleResult.hasCycle) {
    console.log(`❌ Circular dependency detected: ${cycleResult.cycle?.join(' → ')}`);
    console.log('🛑 Cannot proceed - please resolve circular dependencies first.');
    return;
  } else {
    console.log('✅ No circular dependencies detected');
  }

  // 2. Get resolution order
  const resolutionOrder = graph.getResolutionOrder();
  console.log(`\n📊 Dependency Resolution Order:`);
  console.log(`   Sequential: ${resolutionOrder.order.join(' → ')}`);
  
  console.log(`\n🔄 Parallel Execution Levels:`);
  resolutionOrder.levels.forEach((level, index) => {
    console.log(`   Level ${index + 1}: [${level.join(', ')}] - can run in parallel`);
  });

  // 3. Show ready tasks
  console.log(`\n🟢 Tasks Ready to Start: [${graph.getReadyNodes().join(', ')}]`);

  // 4. Simulate completion and show progression
  console.log('\n⏳ Simulating Task Completion:');
  const completed = new Set<number>();
  
  // Complete tasks in levels
  resolutionOrder.levels.forEach((level, levelIndex) => {
    console.log(`\n   📌 Completing Level ${levelIndex + 1}: [${level.join(', ')}]`);
    level.forEach(taskId => completed.add(taskId));
    
    const nextReady = graph.getReadyNodes(completed);
    if (nextReady.length > 0) {
      console.log(`   🟢 Next Ready: [${nextReady.join(', ')}]`);
    } else {
      console.log(`   ✅ All tasks completed!`);
    }
  });

  // 5. Show dependency analysis for specific tasks
  console.log('\n🔍 Dependency Analysis:');
  
  const task4 = graph.getNode(4);
  if (task4) {
    const transitiveDeps = graph.getTransitiveDependencies(4);
    console.log(`   Task 4 depends on (transitively): [${transitiveDeps.join(', ')}]`);
    
    const task1Dependents = graph.getTransitiveDependents(1);
    console.log(`   Task 1 is needed by (transitively): [${task1Dependents.join(', ')}]`);
  }

  // 6. Show what gets blocked if a task fails
  console.log('\n🚫 Impact Analysis:');
  console.log('   If Task 3 (YAML parsing) fails:');
  const blockedByTask3 = graph.getBlockedNodes(3);
  const transitivelyBlocked = graph.getTransitiveDependents(3);
  console.log(`   - Directly blocked: [${blockedByTask3.join(', ')}]`);
  console.log(`   - Transitively blocked: [${transitivelyBlocked.join(', ')}]`);

  console.log('\n🎉 Dependency tracking analysis complete!');
  console.log('\n💡 Benefits of this implementation:');
  console.log('   ✅ Prevents circular dependencies');
  console.log('   ✅ Optimizes task execution order');
  console.log('   ✅ Enables parallel execution where possible');
  console.log('   ✅ Provides impact analysis for blocked tasks');
  console.log('   ✅ Tracks transitive dependencies automatically');
}

function demonstrateErrorDetection(): void {
  console.log('\n🔍 Demonstrating Cycle Detection');
  console.log('==================================\n');

  // Create a graph with a cycle
  const cyclicGraph = new DependencyGraph();
  cyclicGraph.addNode(1, [3]); // Task 1 depends on Task 3
  cyclicGraph.addNode(2, [1]); // Task 2 depends on Task 1
  cyclicGraph.addNode(3, [2]); // Task 3 depends on Task 2 -> creates cycle!

  console.log('📋 Tasks with Circular Dependencies:');
  console.log('   1: Setup (depends on: [3])');
  console.log('   2: Implementation (depends on: [1])');
  console.log('   3: Testing (depends on: [2])');
  console.log('\n   This creates a cycle: 1 → 3 → 2 → 1');

  const cycleResult = cyclicGraph.detectCycles();
  if (cycleResult.hasCycle) {
    console.log(`\n❌ Cycle detected: ${cycleResult.cycle?.join(' → ')}`);
    console.log('🛑 System would prevent issue creation and show error message');
  }

  // Show how to fix it
  console.log('\n🔧 Fixing the cycle:');
  const fixedGraph = new DependencyGraph();
  fixedGraph.addNode(1, []); // Setup has no dependencies
  fixedGraph.addNode(2, [1]); // Implementation depends on Setup
  fixedGraph.addNode(3, [2]); // Testing depends on Implementation

  const fixedResult = fixedGraph.detectCycles();
  console.log(`✅ After fix - Cycles: ${fixedResult.hasCycle ? 'Found' : 'None'}`);
  
  const fixedOrder = fixedGraph.getResolutionOrder();
  console.log(`✅ Valid resolution order: ${fixedOrder.order.join(' → ')}`);
}

if (require.main === module) {
  demonstrateDependencyTracking();
  demonstrateErrorDetection();
}