#!/usr/bin/env ts-node

/**
 * Test script for enhanced dependency scanning logic
 * 
 * Tests the new DependencyGraphAnalyzer class with advanced algorithms
 */

import { 
  DependencyGraphAnalyzer, 
  parseIssueBody, 
  type ParsedIssueData,
  type DependencyNode,
  type CircularDependency,
  type ResolutionOrder,
  type CriticalPath
} from '../scripts/issue-parser';

function runTests(): void {
  console.log('🧪 Testing Enhanced Dependency Scanning Logic\n');

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

  // Test data - complex dependency graph
  const testIssues: ParsedIssueData[] = [
    {
      yamlFrontMatter: { id: 1, dependencies: [] },
      metadata: { status: 'completed', priority: 'high' },
      dependencies: [],
      requiredBy: [],
      rawBody: '',
    },
    {
      yamlFrontMatter: { id: 2, dependencies: [1] },
      metadata: { status: 'pending', priority: 'medium' },
      dependencies: [{ issueNumber: 1, completed: true }],
      requiredBy: [],
      rawBody: '',
    },
    {
      yamlFrontMatter: { id: 3, dependencies: [1] },
      metadata: { status: 'pending', priority: 'high' },
      dependencies: [{ issueNumber: 1, completed: true }],
      requiredBy: [],
      rawBody: '',
    },
    {
      yamlFrontMatter: { id: 4, dependencies: [2, 3] },
      metadata: { status: 'pending', priority: 'low' },
      dependencies: [
        { issueNumber: 2, completed: false },
        { issueNumber: 3, completed: false }
      ],
      requiredBy: [],
      rawBody: '',
    },
    {
      yamlFrontMatter: { id: 5, dependencies: [4] },
      metadata: { status: 'pending', priority: 'critical' },
      dependencies: [{ issueNumber: 4, completed: false }],
      requiredBy: [],
      rawBody: '',
    }
  ];

  // Test circular dependency data
  const cyclicIssues: ParsedIssueData[] = [
    {
      yamlFrontMatter: { id: 10, dependencies: [11] },
      metadata: { status: 'pending', priority: 'medium' },
      dependencies: [{ issueNumber: 11, completed: false }],
      requiredBy: [],
      rawBody: '',
    },
    {
      yamlFrontMatter: { id: 11, dependencies: [12] },
      metadata: { status: 'pending', priority: 'medium' },
      dependencies: [{ issueNumber: 12, completed: false }],
      requiredBy: [],
      rawBody: '',
    },
    {
      yamlFrontMatter: { id: 12, dependencies: [10] },
      metadata: { status: 'pending', priority: 'medium' },
      dependencies: [{ issueNumber: 10, completed: false }],
      requiredBy: [],
      rawBody: '',
    }
  ];

  // Test 1: Dependency graph building
  const graph = DependencyGraphAnalyzer.buildDependencyGraph(testIssues);
  test('Dependency graph building', graph.size === 5);

  // Test 2: Node structure validation
  const node1 = graph.get(1);
  const node4 = graph.get(4);
  test('Node 1 has no dependencies', node1?.dependencies.length === 0);
  test('Node 1 has correct dependents', node1?.dependents.length === 2);
  test('Node 4 has correct dependencies', node4?.dependencies.length === 2);

  // Test 3: Circular dependency detection
  const cyclicGraph = DependencyGraphAnalyzer.buildDependencyGraph(cyclicIssues);
  const cycles = DependencyGraphAnalyzer.detectCircularDependencies(cyclicGraph);
  test('Circular dependency detection', cycles.length > 0);
  test('Cycle description contains issue references', cycles[0]?.description.includes('#'));

  // Test 4: Dependency resolution order
  const resolutionOrder = DependencyGraphAnalyzer.getDependencyResolutionOrder(graph);
  test('Resolution order calculated', resolutionOrder.order.length > 0);
  test('No cycles in acyclic graph', !resolutionOrder.hasCycles);
  test('All nodes included in resolution', resolutionOrder.resolvedNodes === resolutionOrder.totalNodes);
  
  // Test that node 1 comes before its dependents
  const node1Index = resolutionOrder.order.indexOf(1);
  const node2Index = resolutionOrder.order.indexOf(2);
  const node3Index = resolutionOrder.order.indexOf(3);
  test('Dependency resolution order respects dependencies', 
    node1Index < node2Index && node1Index < node3Index);

  // Test 5: Priority-based resolution
  // Node 3 should come before node 2 due to higher priority
  test('Priority-based resolution order', node3Index < node2Index);

  // Test 6: Unblockable issues detection
  const unblockable = DependencyGraphAnalyzer.findUnblockableIssues(graph, [2, 3]);
  test('Unblockable issues detection', unblockable.includes(4));
  test('Correct number of unblockable issues', unblockable.length === 1);

  // Test 7: Critical path calculation
  const criticalPath = DependencyGraphAnalyzer.calculateCriticalPath(graph);
  test('Critical path calculated', criticalPath.path.length > 0);
  test('Critical path starts from root', criticalPath.path[0] === 1);
  test('Critical path ends at leaf', criticalPath.path[criticalPath.path.length - 1] === 5);

  // Test 8: Cyclic graph resolution order
  const cyclicResolution = DependencyGraphAnalyzer.getDependencyResolutionOrder(cyclicGraph);
  test('Cyclic graph detected', cyclicResolution.hasCycles);
  test('Cycle information included', cyclicResolution.cycles.length > 0);

  // Test 9: Performance with larger graph
  const largeIssues: ParsedIssueData[] = [];
  for (let i = 1; i <= 100; i++) {
    largeIssues.push({
      yamlFrontMatter: { id: i, dependencies: i > 1 ? [i - 1] : [] },
      metadata: { status: 'pending', priority: 'medium' },
      dependencies: i > 1 ? [{ issueNumber: i - 1, completed: false }] : [],
      requiredBy: [],
      rawBody: '',
    });
  }
  
  const largeGraph = DependencyGraphAnalyzer.buildDependencyGraph(largeIssues);
  const largeResolution = DependencyGraphAnalyzer.getDependencyResolutionOrder(largeGraph);
  test('Large graph processing', largeGraph.size === 100);
  test('Large graph resolution order', largeResolution.order.length === 100);

  // Test 10: Error handling with malformed data
  const malformedIssues: ParsedIssueData[] = [
    {
      yamlFrontMatter: { dependencies: [999] }, // No ID
      metadata: {},
      dependencies: [],
      requiredBy: [],
      rawBody: '',
    }
  ];
  
  const malformedGraph = DependencyGraphAnalyzer.buildDependencyGraph(malformedIssues);
  test('Malformed data handling', malformedGraph.size === 0);

  console.log(`\n📊 Test Results: ${passed}/${total} passed (${Math.round(passed/total*100)}% success rate)`);

  if (passed === total) {
    console.log('\n🎉 All enhanced dependency scanning logic tests passed!');
    console.log('\n✅ Enhanced dependency scanning capabilities:');
    console.log('  • Advanced dependency graph building');
    console.log('  • Circular dependency detection');
    console.log('  • Priority-based resolution ordering');
    console.log('  • Efficient unblockable issue detection');
    console.log('  • Critical path analysis');
    console.log('  • Large-scale graph processing');
    console.log('  • Robust error handling');
  } else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  }
}

runTests();