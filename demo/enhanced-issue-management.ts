/**
 * Enhanced Issue Management with Parser Integration
 * 
 * This example shows how to integrate the YAML front-matter parser
 * with existing GitHub issue management functionality.
 */

import { parseIssueBody, ParsedIssueData } from '../scripts/issue-parser';

// Mock GitHub API types for demonstration
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
}

/**
 * Enhanced issue analyzer that uses the parser to extract structured data
 */
class EnhancedIssueAnalyzer {
  /**
   * Analyze an issue and extract all structured data
   */
  analyzeIssue(issue: GitHubIssue): ParsedIssueData & {
    issueNumber: number;
    title: string;
    state: string;
    labels: string[];
  } {
    const parsedData = parseIssueBody(issue.body);
    
    return {
      ...parsedData,
      issueNumber: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels
    };
  }

  /**
   * Check if issue is blocked by dependencies
   */
  isBlocked(issue: GitHubIssue): boolean {
    const parsed = parseIssueBody(issue.body);
    return parsed.dependencies.some(dep => !dep.completed);
  }

  /**
   * Get blocking dependencies
   */
  getBlockingDependencies(issue: GitHubIssue): Array<{ issueNumber: number; title?: string }> {
    const parsed = parseIssueBody(issue.body);
    return parsed.dependencies
      .filter(dep => !dep.completed)
      .map(dep => ({ issueNumber: dep.issueNumber, title: dep.title }));
  }

  /**
   * Calculate dependency completion percentage
   */
  getDependencyProgress(issue: GitHubIssue): number {
    const parsed = parseIssueBody(issue.body);
    if (parsed.dependencies.length === 0) return 100;
    
    const completed = parsed.dependencies.filter(dep => dep.completed).length;
    return Math.round((completed / parsed.dependencies.length) * 100);
  }

  /**
   * Get task hierarchy information
   */
  getTaskHierarchy(issue: GitHubIssue): {
    taskId?: number;
    parentId?: number;
    isSubtask: boolean;
    isMainTask: boolean;
  } {
    const parsed = parseIssueBody(issue.body);
    
    return {
      taskId: parsed.yamlFrontMatter.id,
      parentId: parsed.yamlFrontMatter.parent,
      isSubtask: parsed.yamlFrontMatter.parent !== undefined,
      isMainTask: parsed.yamlFrontMatter.parent === undefined && parsed.yamlFrontMatter.id !== undefined
    };
  }

  /**
   * Generate suggested labels based on parsed data
   */
  generateSuggestedLabels(issue: GitHubIssue): string[] {
    const parsed = parseIssueBody(issue.body);
    const labels: string[] = [];

    // Add taskmaster label if it has YAML front-matter
    if (parsed.yamlFrontMatter.id !== undefined) {
      labels.push('taskmaster');
    }

    // Add status labels
    if (parsed.metadata.status) {
      labels.push(`status:${parsed.metadata.status}`);
    }

    // Add priority labels
    if (parsed.metadata.priority) {
      labels.push(`priority:${parsed.metadata.priority}`);
    }

    // Add complexity labels
    if (parsed.metadata.complexity) {
      labels.push(`complexity:${parsed.metadata.complexity}`);
    }

    // Add dependency status labels
    if (parsed.dependencies.length > 0) {
      labels.push('has-dependencies');
      
      const blockedDeps = parsed.dependencies.filter(dep => !dep.completed);
      if (blockedDeps.length > 0) {
        labels.push('blocked');
        labels.push(`blocked-by:${blockedDeps.length}`);
      } else {
        labels.push('ready');
      }
    }

    // Add hierarchy labels
    if (parsed.yamlFrontMatter.parent !== undefined) {
      labels.push('subtask');
    } else if (parsed.yamlFrontMatter.id !== undefined) {
      labels.push('main-task');
    }

    return labels;
  }
}

/**
 * Issue dependency tracker that uses the parser
 */
class IssueDependencyTracker {
  /**
   * Build dependency graph from a list of issues
   */
  buildDependencyGraph(issues: GitHubIssue[]): Map<number, {
    issue: GitHubIssue;
    dependencies: number[];
    dependents: number[];
    blocked: boolean;
  }> {
    const graph = new Map();
    
    // First pass: collect all issues and their dependencies
    for (const issue of issues) {
      const parsed = parseIssueBody(issue.body);
      // Use YAML front-matter dependencies if available, otherwise fall back to Dependencies section
      const dependencies = parsed.yamlFrontMatter.dependencies || 
                          parsed.dependencies.map(dep => dep.issueNumber);
      
      graph.set(issue.number, {
        issue,
        dependencies,
        dependents: [],
        blocked: dependencies.length > 0
      });
    }
    
    // Second pass: build reverse dependencies (dependents)
    for (const [issueNumber, node] of graph) {
      for (const depNumber of node.dependencies) {
        const depNode = graph.get(depNumber);
        if (depNode) {
          depNode.dependents.push(issueNumber);
        }
      }
    }
    
    return graph;
  }

  /**
   * Find issues that can be unblocked by closing a specific issue
   */
  findUnblockableIssues(closedIssueNumber: number, issues: GitHubIssue[]): GitHubIssue[] {
    const unblockable: GitHubIssue[] = [];
    
    for (const issue of issues) {
      if (issue.state === 'closed') continue;
      
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
    }
    
    return unblockable;
  }

  /**
   * Detect cycles in the dependency graph
   */
  detectCycles(issues: GitHubIssue[]): Array<{ cycle: number[]; description: string }> {
    const graph = this.buildDependencyGraph(issues);
    const cycles: Array<{ cycle: number[]; description: string }> = [];
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    const currentPath: number[] = [];

    function dfs(issueNumber: number): boolean {
      if (recursionStack.has(issueNumber)) {
        // Found a cycle - extract the cycle from current path
        const cycleStartIndex = currentPath.indexOf(issueNumber);
        const cycle = currentPath.slice(cycleStartIndex);
        cycle.push(issueNumber); // Close the cycle
        
        const issueNumbers = cycle.map(n => `#${n}`).join(' → ');
        cycles.push({
          cycle,
          description: `Circular dependency detected: ${issueNumbers}`
        });
        return true;
      }

      if (visited.has(issueNumber)) {
        return false;
      }

      visited.add(issueNumber);
      recursionStack.add(issueNumber);
      currentPath.push(issueNumber);

      const node = graph.get(issueNumber);
      if (node) {
        for (const dependency of node.dependencies) {
          if (dfs(dependency)) {
            return true;
          }
        }
      }

      recursionStack.delete(issueNumber);
      currentPath.pop();
      return false;
    }

    // Check each node for cycles
    for (const [issueNumber] of graph) {
      if (!visited.has(issueNumber)) {
        dfs(issueNumber);
      }
    }

    return cycles;
  }

  /**
   * Get dependency resolution order using topological sort
   */
  getDependencyResolutionOrder(issues: GitHubIssue[]): {
    order: number[];
    hasCycles: boolean;
    cycles: Array<{ cycle: number[]; description: string }>;
  } {
    const graph = this.buildDependencyGraph(issues);
    const cycles = this.detectCycles(issues);
    
    if (cycles.length > 0) {
      return {
        order: [],
        hasCycles: true,
        cycles
      };
    }

    const inDegree = new Map<number, number>();
    const result: number[] = [];
    const queue: number[] = [];

    // Initialize in-degree count for all nodes
    for (const [issueNumber, node] of graph) {
      inDegree.set(issueNumber, node.dependencies.length);
    }

    // Find all nodes with no incoming edges (no dependencies)
    for (const [issueNumber, degree] of inDegree) {
      if (degree === 0) {
        queue.push(issueNumber);
      }
    }

    // Process nodes in topological order
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const node = graph.get(current);
      if (node) {
        // Reduce in-degree for all dependents
        for (const dependent of node.dependents) {
          const currentInDegree = inDegree.get(dependent) || 0;
          const newInDegree = currentInDegree - 1;
          inDegree.set(dependent, newInDegree);

          if (newInDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    return {
      order: result,
      hasCycles: false,
      cycles: []
    };
  }

  /**
   * Get critical path through dependency graph
   */
  getCriticalPath(issues: GitHubIssue[]): number[] {
    const graph = this.buildDependencyGraph(issues);
    const criticalPath: number[] = [];
    const visited = new Set<number>();
    
    // Find root nodes (no dependencies)
    const rootNodes = Array.from(graph.entries())
      .filter(([_, node]) => node.dependencies.length === 0)
      .map(([issueNumber]) => issueNumber);
    
    // DFS to find longest path
    function dfs(issueNumber: number, path: number[]): number[] {
      if (visited.has(issueNumber)) return path;
      
      visited.add(issueNumber);
      const node = graph.get(issueNumber);
      if (!node) return path;
      
      let longestPath = [...path, issueNumber];
      
      for (const dependent of node.dependents) {
        const dependentPath = dfs(dependent, [...path, issueNumber]);
        if (dependentPath.length > longestPath.length) {
          longestPath = dependentPath;
        }
      }
      
      return longestPath;
    }
    
    // Find the longest path from any root
    for (const rootNode of rootNodes) {
      const path = dfs(rootNode, []);
      if (path.length > criticalPath.length) {
        criticalPath.splice(0, criticalPath.length, ...path);
      }
    }
    
    return criticalPath;
  }
}

/**
 * Demo: Show practical integration examples
 */
function demonstrateIntegration(): void {
  console.log('🔧 Enhanced Issue Management Integration Demo');
  console.log('=' .repeat(60));

  // Sample issues
  const sampleIssues: GitHubIssue[] = [
    {
      number: 100,
      title: '[1] Setup project infrastructure',
      state: 'open',
      labels: [],
      body: `---
id: 1
dependencies: []
---

## Description
Setup the basic project infrastructure

## Meta
- **Status**: \`active\`
- **Priority**: \`high\``
    },
    {
      number: 101,
      title: '[2] Implement database layer',
      state: 'open',
      labels: [],
      body: `---
id: 2
dependencies: [1]
---

## Description
Implement the database abstraction layer

## Dependencies
- [x] #100 Setup project infrastructure

## Meta
- **Status**: \`pending\`
- **Priority**: \`medium\`
- **Complexity**: \`high\``
    },
    {
      number: 102,
      title: '[3] Create API endpoints',
      state: 'open',
      labels: [],
      body: `---
id: 3
dependencies: [1, 2]
---

## Description
Create REST API endpoints

## Dependencies
- [x] #100 Setup project infrastructure
- [ ] #101 Implement database layer

## Meta
- **Status**: \`blocked\`
- **Priority**: \`high\``
    }
  ];

  const analyzer = new EnhancedIssueAnalyzer();
  const tracker = new IssueDependencyTracker();

  console.log('📊 Issue Analysis:');
  sampleIssues.forEach(issue => {
    console.log(`\n  Issue #${issue.number}: ${issue.title}`);
    
    const isBlocked = analyzer.isBlocked(issue);
    console.log(`    Blocked: ${isBlocked ? '🔒 Yes' : '✅ No'}`);
    
    if (isBlocked) {
      const blockingDeps = analyzer.getBlockingDependencies(issue);
      console.log(`    Blocking Dependencies: ${blockingDeps.map(d => `#${d.issueNumber}`).join(', ')}`);
    }
    
    const progress = analyzer.getDependencyProgress(issue);
    console.log(`    Dependency Progress: ${progress}%`);
    
    const hierarchy = analyzer.getTaskHierarchy(issue);
    console.log(`    Task Type: ${hierarchy.isMainTask ? 'Main Task' : hierarchy.isSubtask ? 'Subtask' : 'Regular Issue'}`);
    
    const suggestedLabels = analyzer.generateSuggestedLabels(issue);
    console.log(`    Suggested Labels: ${suggestedLabels.join(', ')}`);
  });

  console.log('\n🔗 Dependency Graph Analysis:');
  const graph = tracker.buildDependencyGraph(sampleIssues);
  
  for (const [issueNumber, node] of graph) {
    console.log(`  Issue #${issueNumber}:`);
    console.log(`    Dependencies: ${node.dependencies.length ? node.dependencies.map(d => `#${d}`).join(', ') : 'None'}`);
    console.log(`    Dependents: ${node.dependents.length ? node.dependents.map(d => `#${d}`).join(', ') : 'None'}`);
  }

  console.log('\n🎯 Critical Path:');
  const criticalPath = tracker.getCriticalPath(sampleIssues);
  console.log(`  Path: ${criticalPath.map(n => `#${n}`).join(' → ')}`);

  console.log('\n🔓 Unblocking Simulation:');
  const unblockable = tracker.findUnblockableIssues(101, sampleIssues);
  console.log(`  If issue #101 is closed, it would unblock: ${unblockable.map(i => `#${i.number}`).join(', ') || 'No issues'}`);

  console.log('\n🔍 Cycle Detection:');
  const cycles = tracker.detectCycles(sampleIssues);
  if (cycles.length === 0) {
    console.log('  ✅ No dependency cycles detected');
  } else {
    cycles.forEach(cycle => {
      console.log(`  🔄 ${cycle.description}`);
    });
  }

  console.log('\n📊 Dependency Resolution Order:');
  const resolutionOrder = tracker.getDependencyResolutionOrder(sampleIssues);
  if (resolutionOrder.hasCycles) {
    console.log('  ❌ Cannot determine order due to dependency cycles:');
    resolutionOrder.cycles.forEach(cycle => {
      console.log(`    ${cycle.description}`);
    });
  } else {
    console.log(`  ✅ Optimal resolution order: ${resolutionOrder.order.map(n => `#${n}`).join(' → ')}`);
  }

  console.log('\n✅ Integration demo completed');
}

/**
 * Demo: Show cycle detection with circular dependencies
 */
function demonstrateCycleDetection(): void {
  console.log('\n🔄 Cycle Detection Demo');
  console.log('=' .repeat(40));

  // Sample issues with circular dependencies
  const cyclicIssues: GitHubIssue[] = [
    {
      number: 200,
      title: '[A] Task A',
      state: 'open',
      labels: [],
      body: `---
id: 200
dependencies: [202]
---

## Description
Task A depends on Task C

## Dependencies
- [ ] #202 Task C`
    },
    {
      number: 201,
      title: '[B] Task B',
      state: 'open',
      labels: [],
      body: `---
id: 201
dependencies: [200]
---

## Description
Task B depends on Task A

## Dependencies
- [ ] #200 Task A`
    },
    {
      number: 202,
      title: '[C] Task C',
      state: 'open',
      labels: [],
      body: `---
id: 202
dependencies: [201]
---

## Description
Task C depends on Task B

## Dependencies
- [ ] #201 Task B`
    }
  ];

  const tracker = new IssueDependencyTracker();

  console.log('📋 Issues:');
  cyclicIssues.forEach(issue => {
    console.log(`  ${issue.title}`);
  });

  console.log('\n🔍 Cycle Detection:');
  const cycles = tracker.detectCycles(cyclicIssues);
  if (cycles.length === 0) {
    console.log('  ✅ No dependency cycles detected');
  } else {
    cycles.forEach((cycle, index) => {
      console.log(`  🔄 Cycle ${index + 1}: ${cycle.description}`);
    });
  }

  console.log('\n📊 Dependency Resolution Order:');
  const resolutionOrder = tracker.getDependencyResolutionOrder(cyclicIssues);
  if (resolutionOrder.hasCycles) {
    console.log('  ❌ Cannot determine order due to dependency cycles:');
    resolutionOrder.cycles.forEach(cycle => {
      console.log(`    ${cycle.description}`);
    });
  } else {
    console.log(`  ✅ Optimal resolution order: ${resolutionOrder.order.map(n => `#${n}`).join(' → ')}`);
  }

  console.log('\n✅ Cycle detection demo completed');
}

/**
 * Example: How to use the parser in the existing create-issues workflow
 */
function showWorkflowIntegration(): void {
  console.log('\n🔄 Workflow Integration Example');
  console.log('=' .repeat(50));

  console.log('The parser can be integrated into existing workflows to:');
  console.log('  1. 📝 Parse existing issues to extract current state');
  console.log('  2. 🔍 Validate issue structure before updates');
  console.log('  3. 🏷️ Generate accurate labels based on parsed metadata');
  console.log('  4. 🔗 Track dependency relationships automatically');
  console.log('  5. 📊 Generate reports on project progress');
  console.log('  6. 🚦 Identify blocked tasks and critical paths');
  
  console.log('\n📋 Example Integration Points:');
  console.log('  • actions/taskmaster-generate/src/main.ts - parseTaskGraphAndCreateIssues()');
  console.log('  • actions/taskmaster-watcher/src/main.ts - issue status monitoring');
  console.log('  • create-issues.ts - enhanced issue creation and updates');
  
  console.log('\n💡 Parser Usage Pattern:');
  console.log(`
import { parseIssueBody, ParsedIssueData } from '../scripts/issue-parser';

// In your GitHub API workflow:
const existingIssue = await githubApi.getIssue(issueNumber);
const parsedData: ParsedIssueData = parseIssueBody(existingIssue.body);

// Extract task information
const taskId = parsedData.yamlFrontMatter.id;
const dependencies = parsedData.dependencies;
const status = parsedData.metadata.status;

// Make decisions based on parsed data
if (dependencies.some(dep => !dep.completed)) {
  console.log('Issue is blocked by dependencies');
  // Add blocked label, update status, etc.
}
`);
}

// Run the integration demo
if (require.main === module) {
  demonstrateIntegration();
  demonstrateCycleDetection();
  showWorkflowIntegration();
}

export { EnhancedIssueAnalyzer, IssueDependencyTracker, demonstrateIntegration, demonstrateCycleDetection };