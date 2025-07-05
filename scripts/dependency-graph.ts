/**
 * Dependency Graph Data Structure
 * 
 * Provides graph representation, cycle detection, and dependency resolution ordering
 * for task dependencies in the taskmaster system.
 */

export interface DependencyNode {
  id: number;
  dependencies: number[];
  dependents: number[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycle?: number[];
}

export interface ResolutionOrder {
  order: number[];
  levels: number[][];
}

export class DependencyGraph {
  private nodes: Map<number, DependencyNode> = new Map();

  /**
   * Add a node to the graph
   */
  addNode(id: number, dependencies: number[] = []): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        dependencies: [...dependencies],
        dependents: []
      });
    } else {
      // Update dependencies if node exists
      const node = this.nodes.get(id)!;
      node.dependencies = [...dependencies];
    }

    // Ensure all dependency nodes exist and update their dependents
    for (const depId of dependencies) {
      if (!this.nodes.has(depId)) {
        this.addNode(depId, []);
      }
      const depNode = this.nodes.get(depId)!;
      if (!depNode.dependents.includes(id)) {
        depNode.dependents.push(id);
      }
    }
  }

  /**
   * Get a node by ID
   */
  getNode(id: number): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Remove a node from the graph
   */
  removeNode(id: number): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove this node from all its dependencies' dependents lists
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents = depNode.dependents.filter(d => d !== id);
      }
    }

    // Remove this node from all its dependents' dependencies lists
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (dependentNode) {
        dependentNode.dependencies = dependentNode.dependencies.filter(d => d !== id);
      }
    }

    this.nodes.delete(id);
  }

  /**
   * Detect cycles in the dependency graph using DFS
   */
  detectCycles(): CycleDetectionResult {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    const path: number[] = [];

    const nodeIds = Array.from(this.nodes.keys());
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        const cycle = this.dfsForCycle(nodeId, visited, recursionStack, path);
        if (cycle) {
          return { hasCycle: true, cycle };
        }
      }
    }

    return { hasCycle: false };
  }

  /**
   * DFS helper for cycle detection
   */
  private dfsForCycle(
    nodeId: number, 
    visited: Set<number>, 
    recursionStack: Set<number>, 
    path: number[]
  ): number[] | null {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return null;

    for (const depId of node.dependencies) {
      if (!visited.has(depId)) {
        const cycle = this.dfsForCycle(depId, visited, recursionStack, path);
        if (cycle) return cycle;
      } else if (recursionStack.has(depId)) {
        // Found a back edge - extract the cycle
        const cycleStart = path.indexOf(depId);
        return path.slice(cycleStart).concat([depId]);
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return null;
  }

  /**
   * Get dependency resolution order using topological sort (Kahn's algorithm)
   */
  getResolutionOrder(): ResolutionOrder {
    const cycleResult = this.detectCycles();
    if (cycleResult.hasCycle) {
      throw new Error(`Circular dependency detected: ${cycleResult.cycle?.join(' -> ')}`);
    }

    // Create a copy of in-degrees for each node
    const inDegree = new Map<number, number>();
    const nodes = Array.from(this.nodes.values());
    for (const node of nodes) {
      inDegree.set(node.id, node.dependencies.length);
    }

    // Queue of nodes with no dependencies
    const queue: number[] = [];
    const inDegreeEntries = Array.from(inDegree.entries());
    for (const [nodeId, degree] of inDegreeEntries) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const order: number[] = [];
    const levels: number[][] = [];

    while (queue.length > 0) {
      const currentLevel: number[] = [];
      const levelSize = queue.length;

      // Process all nodes at the current level
      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue.shift()!;
        currentLevel.push(nodeId);
        order.push(nodeId);

        const node = this.nodes.get(nodeId);
        if (node) {
          // Reduce in-degree for all dependents
          for (const dependentId of node.dependents) {
            const currentInDegree = inDegree.get(dependentId)! - 1;
            inDegree.set(dependentId, currentInDegree);
            
            if (currentInDegree === 0) {
              queue.push(dependentId);
            }
          }
        }
      }

      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }

    // Check if all nodes were processed (no cycles)
    if (order.length !== this.nodes.size) {
      throw new Error('Failed to resolve all dependencies - possible cycle detected');
    }

    return { order, levels };
  }

  /**
   * Get nodes that are ready to be processed (have no unresolved dependencies)
   */
  getReadyNodes(completedNodes: Set<number> = new Set()): number[] {
    const ready: number[] = [];

    const nodes = Array.from(this.nodes.values());
    for (const node of nodes) {
      // Skip if this node is already completed
      if (completedNodes.has(node.id)) {
        continue;
      }

      const unresolvedDeps = node.dependencies.filter(depId => !completedNodes.has(depId));
      if (unresolvedDeps.length === 0) {
        ready.push(node.id);
      }
    }

    return ready;
  }

  /**
   * Get nodes that are blocked by the given node
   */
  getBlockedNodes(nodeId: number): number[] {
    const node = this.nodes.get(nodeId);
    return node ? [...node.dependents] : [];
  }

  /**
   * Get the transitive dependencies of a node (all nodes it depends on, directly or indirectly)
   */
  getTransitiveDependencies(nodeId: number): number[] {
    const visited = new Set<number>();
    const dependencies: number[] = [];

    const dfs = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          dependencies.push(depId);
          dfs(depId);
        }
      }
    };

    dfs(nodeId);
    // Remove duplicates by converting to Set and back to Array
    const uniqueDependencies = Array.from(new Set(dependencies));
    return uniqueDependencies;
  }

  /**
   * Get the transitive dependents of a node (all nodes that depend on it, directly or indirectly)
   */
  getTransitiveDependents(nodeId: number): number[] {
    const visited = new Set<number>();
    const dependents: number[] = [];

    const dfs = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const dependentId of node.dependents) {
          dependents.push(dependentId);
          dfs(dependentId);
        }
      }
    };

    dfs(nodeId);
    // Remove duplicates by converting to Set and back to Array
    const uniqueDependents = Array.from(new Set(dependents));
    return uniqueDependents;
  }
}

/**
 * Create a dependency graph from a list of tasks
 */
export function createDependencyGraphFromTasks(tasks: Array<{ id: number; dependencies?: number[] }>): DependencyGraph {
  const graph = new DependencyGraph();

  for (const task of tasks) {
    graph.addNode(task.id, task.dependencies || []);
  }

  return graph;
}