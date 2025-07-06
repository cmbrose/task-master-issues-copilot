/**
 * Issue Parser
 * 
 * Parses structured data from GitHub issue descriptions, including YAML front-matter,
 * dependencies, priority, and other metadata fields.
 */

import * as yaml from 'js-yaml';

// Interfaces for parsed data
export interface ParsedYamlFrontMatter {
  id?: number;
  parent?: number;
  dependencies?: number[];
  [key: string]: any;
}

export interface ParsedMetadata {
  status?: string;
  priority?: string;
  complexity?: string;
  [key: string]: string | undefined;
}

export interface ParsedDependency {
  issueNumber: number;
  completed: boolean;
  title?: string;
}

export interface ParsedIssueData {
  yamlFrontMatter: ParsedYamlFrontMatter;
  metadata: ParsedMetadata;
  dependencies: ParsedDependency[];
  requiredBy: ParsedDependency[];
  description?: string;
  details?: string;
  testStrategy?: string;
  rawBody: string;
}

/**
 * Parse YAML front-matter from issue body
 */
export function parseYamlFrontMatter(body: string): ParsedYamlFrontMatter {
  const frontMatterMatch = body.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontMatterMatch) {
    return {};
  }
  
  try {
    const yamlContent = frontMatterMatch[1];
    const parsed = yaml.load(yamlContent) as any;
    
    // Ensure arrays are properly parsed
    if (parsed && typeof parsed === 'object') {
      // Handle dependencies array format
      if (parsed.dependencies) {
        if (typeof parsed.dependencies === 'string') {
          // Handle format like "dependencies: [1, 2, 3]"
          const arrayMatch = parsed.dependencies.match(/\[([^\]]+)\]/);
          if (arrayMatch) {
            parsed.dependencies = arrayMatch[1]
              .split(',')
              .map((dep: string) => parseInt(dep.trim(), 10))
              .filter((dep: number) => !isNaN(dep));
          }
        } else if (Array.isArray(parsed.dependencies)) {
          // Already an array, ensure numbers
          parsed.dependencies = parsed.dependencies
            .map((dep: any) => typeof dep === 'number' ? dep : parseInt(String(dep), 10))
            .filter((dep: number) => !isNaN(dep));
        }
      }
      
      // Ensure id and parent are numbers
      if (parsed.id !== undefined) {
        parsed.id = typeof parsed.id === 'number' ? parsed.id : parseInt(String(parsed.id), 10);
      }
      if (parsed.parent !== undefined) {
        parsed.parent = typeof parsed.parent === 'number' ? parsed.parent : parseInt(String(parsed.parent), 10);
      }
    }
    
    return parsed || {};
  } catch (error) {
    console.warn('Failed to parse YAML front-matter:', error);
    return {};
  }
}

/**
 * Parse metadata from Meta section
 */
export function parseMetadata(body: string): ParsedMetadata {
  const metaMatch = body.match(/## Meta\s*\n\n([\s\S]*?)(?:\n\n|$)/);
  
  if (!metaMatch) {
    return {};
  }
  
  const metaContent = metaMatch[1];
  const metadata: ParsedMetadata = {};
  
  // Parse lines like "- **Status**: `pending`"
  const metaLines = metaContent.split('\n');
  
  for (const line of metaLines) {
    const match = line.match(/- \*\*([^*]+)\*\*:\s*`([^`]+)`/);
    if (match) {
      const key = match[1].toLowerCase().trim();
      const value = match[2].trim();
      metadata[key] = value;
    }
  }
  
  return metadata;
}

/**
 * Parse dependencies from Dependencies section
 */
export function parseDependencies(body: string): ParsedDependency[] {
  const depsMatch = body.match(/## Dependencies\s*\n\n([\s\S]*?)(?:\n\n|$)/);
  
  if (!depsMatch) {
    return [];
  }
  
  const depsContent = depsMatch[1];
  const dependencies: ParsedDependency[] = [];
  
  // Parse lines like "- [x] #123" or "- [ ] Task #456"
  const depLines = depsContent.split('\n');
  
  for (const line of depLines) {
    const match = line.match(/- \[([x ])\]\s*(?:Task\s*)?#(\d+)(?:\s+(.*))?/);
    if (match) {
      const completed = match[1] === 'x';
      const issueNumber = parseInt(match[2], 10);
      const title = match[3]?.trim();
      
      dependencies.push({
        issueNumber,
        completed,
        title
      });
    }
  }
  
  return dependencies;
}

/**
 * Parse required-by relationships from Required By section
 */
export function parseRequiredBy(body: string): ParsedDependency[] {
  const reqByMatch = body.match(/## Required By\s*\n\n([\s\S]*?)(?:\n\n|$)/);
  
  if (!reqByMatch) {
    return [];
  }
  
  const reqByContent = reqByMatch[1];
  const requiredBy: ParsedDependency[] = [];
  
  // Parse lines like "- [ ] #123"
  const reqByLines = reqByContent.split('\n');
  
  for (const line of reqByLines) {
    const match = line.match(/- \[([x ])\]\s*#(\d+)(?:\s+(.*))?/);
    if (match) {
      const completed = match[1] === 'x';
      const issueNumber = parseInt(match[2], 10);
      const title = match[3]?.trim();
      
      requiredBy.push({
        issueNumber,
        completed,
        title
      });
    }
  }
  
  return requiredBy;
}

/**
 * Parse content sections (Description, Details, Test Strategy)
 */
export function parseContentSections(body: string): {
  description?: string;
  details?: string;
  testStrategy?: string;
} {
  const result: { description?: string; details?: string; testStrategy?: string } = {};
  
  // Parse Description section
  const descMatch = body.match(/## Description\s*\n\n([\s\S]*?)(?:\n\n##|\n\n<!-- |$)/);
  if (descMatch) {
    result.description = descMatch[1].trim();
  }
  
  // Parse Details section
  const detailsMatch = body.match(/## Details\s*\n\n([\s\S]*?)(?:\n\n##|\n\n<!-- |$)/);
  if (detailsMatch) {
    result.details = detailsMatch[1].trim();
  }
  
  // Parse Test Strategy section
  const testMatch = body.match(/## Test Strategy\s*\n\n([\s\S]*?)(?:\n\n##|\n\n<!-- |$)/);
  if (testMatch) {
    result.testStrategy = testMatch[1].trim();
  }
  
  return result;
}

/**
 * Comprehensive parser that extracts all structured data from issue description
 */
export function parseIssueBody(body: string): ParsedIssueData {
  const yamlFrontMatter = parseYamlFrontMatter(body);
  const metadata = parseMetadata(body);
  const dependencies = parseDependencies(body);
  const requiredBy = parseRequiredBy(body);
  const contentSections = parseContentSections(body);
  
  return {
    yamlFrontMatter,
    metadata,
    dependencies,
    requiredBy,
    ...contentSections,
    rawBody: body
  };
}

/**
 * Utility function to check if issue body has YAML front-matter
 */
export function hasYamlFrontMatter(body: string): boolean {
  return /^---\n[\s\S]*?\n---/.test(body);
}

/**
 * Enhanced dependency graph utilities for advanced dependency resolution
 */
export class DependencyGraphAnalyzer {
  /**
   * Build a dependency graph from parsed issue data
   */
  static buildDependencyGraph(issues: ParsedIssueData[]): Map<number, DependencyNode> {
    const graph = new Map<number, DependencyNode>();
    
    // Initialize nodes
    for (const issue of issues) {
      const issueId = issue.yamlFrontMatter.id;
      if (issueId) {
        graph.set(issueId, {
          id: issueId,
          dependencies: [],
          dependents: [],
          status: issue.metadata.status || 'pending',
          priority: issue.metadata.priority || 'medium'
        });
      }
    }
    
    // Build relationships
    for (const issue of issues) {
      const issueId = issue.yamlFrontMatter.id;
      if (!issueId) continue;
      
      const node = graph.get(issueId);
      if (!node) continue;
      
      // Add dependencies from YAML front-matter
      for (const depId of issue.yamlFrontMatter.dependencies || []) {
        node.dependencies.push(depId);
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.push(issueId);
        }
      }
      
      // Add dependencies from parsed dependencies section
      for (const dep of issue.dependencies) {
        if (!node.dependencies.includes(dep.issueNumber)) {
          node.dependencies.push(dep.issueNumber);
          const depNode = graph.get(dep.issueNumber);
          if (depNode) {
            depNode.dependents.push(issueId);
          }
        }
      }
    }
    
    return graph;
  }
  
  /**
   * Detect circular dependencies in the graph
   */
  static detectCircularDependencies(graph: Map<number, DependencyNode>): CircularDependency[] {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    const cycles: CircularDependency[] = [];
    
    function dfs(nodeId: number, path: number[]): boolean {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        cycle.push(nodeId); // Complete the cycle
        
        cycles.push({
          cycle,
          description: `Circular dependency detected: ${cycle.map(id => `#${id}`).join(' → ')}`
        });
        return true;
      }
      
      if (visited.has(nodeId)) {
        return false;
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const node = graph.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (dfs(depId, [...path])) {
            return true;
          }
        }
      }
      
      recursionStack.delete(nodeId);
      path.pop();
      return false;
    }
    
    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }
    
    return cycles;
  }
  
  /**
   * Get dependency resolution order using topological sort with priority
   */
  static getDependencyResolutionOrder(graph: Map<number, DependencyNode>): ResolutionOrder {
    const inDegree = new Map<number, number>();
    const queue: number[] = [];
    const result: number[] = [];
    
    // Calculate in-degrees
    for (const [nodeId, node] of graph) {
      inDegree.set(nodeId, node.dependencies.length);
    }
    
    // Find nodes with no dependencies and sort by priority
    const noDependencyNodes = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .map(([nodeId]) => nodeId)
      .sort((a, b) => {
        const nodeA = graph.get(a);
        const nodeB = graph.get(b);
        const priorityA = getPriorityValue(nodeA?.priority);
        const priorityB = getPriorityValue(nodeB?.priority);
        return priorityB - priorityA; // Higher priority first
      });
    
    queue.push(...noDependencyNodes);
    
    // Process nodes in topological order
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      const node = graph.get(current);
      if (node) {
        // Process dependents sorted by priority
        const sortedDependents = node.dependents
          .map(depId => ({ id: depId, priority: getPriorityValue(graph.get(depId)?.priority) }))
          .sort((a, b) => b.priority - a.priority)
          .map(item => item.id);
          
        for (const dependent of sortedDependents) {
          const currentInDegree = inDegree.get(dependent) || 0;
          const newInDegree = currentInDegree - 1;
          inDegree.set(dependent, newInDegree);
          
          if (newInDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }
    
    const cycles = this.detectCircularDependencies(graph);
    
    return {
      order: result,
      hasCycles: cycles.length > 0,
      cycles,
      totalNodes: graph.size,
      resolvedNodes: result.length
    };
  }
  
  /**
   * Find issues that would be unblocked by resolving specific dependencies
   */
  static findUnblockableIssues(graph: Map<number, DependencyNode>, resolvedIssueIds: number[]): number[] {
    const unblockable: number[] = [];
    
    for (const [nodeId, node] of graph) {
      // Skip if already resolved
      if (resolvedIssueIds.includes(nodeId)) continue;
      
      // Check if any dependencies would be resolved
      const hasResolvedDependency = node.dependencies.some(depId => resolvedIssueIds.includes(depId));
      if (!hasResolvedDependency) continue;
      
      // Check if all other dependencies are already resolved
      const remainingDependencies = node.dependencies.filter(depId => !resolvedIssueIds.includes(depId));
      
      if (remainingDependencies.length === 0) {
        unblockable.push(nodeId);
      }
    }
    
    return unblockable;
  }
  
  /**
   * Calculate critical path through the dependency graph
   */
  static calculateCriticalPath(graph: Map<number, DependencyNode>): CriticalPath {
    const distances = new Map<number, number>();
    const predecessors = new Map<number, number | null>();
    
    // Initialize distances
    for (const nodeId of graph.keys()) {
      distances.set(nodeId, 0);
      predecessors.set(nodeId, null);
    }
    
    // Topological sort for longest path calculation
    const order = this.getDependencyResolutionOrder(graph).order;
    
    for (const nodeId of order) {
      const node = graph.get(nodeId);
      if (!node) continue;
      
      const currentDistance = distances.get(nodeId) || 0;
      
      for (const dependent of node.dependents) {
        const newDistance = currentDistance + 1;
        const currentDepDistance = distances.get(dependent) || 0;
        
        if (newDistance > currentDepDistance) {
          distances.set(dependent, newDistance);
          predecessors.set(dependent, nodeId);
        }
      }
    }
    
    // Find the node with maximum distance (end of critical path)
    let maxDistance = 0;
    let endNode: number | null = null;
    
    for (const [nodeId, distance] of distances) {
      if (distance > maxDistance) {
        maxDistance = distance;
        endNode = nodeId;
      }
    }
    
    // Reconstruct critical path
    const path: number[] = [];
    let current = endNode;
    
    while (current !== null) {
      path.unshift(current);
      current = predecessors.get(current) || null;
    }
    
    return {
      path,
      length: maxDistance,
      estimatedDuration: maxDistance // Can be enhanced with task duration estimates
    };
  }
}

// Helper function to convert priority to numeric value
function getPriorityValue(priority?: string): number {
  switch (priority?.toLowerCase()) {
    case 'critical': return 5;
    case 'high': return 4;
    case 'medium': return 3;
    case 'low': return 2;
    case 'trivial': return 1;
    default: return 3; // default to medium
  }
}

// Enhanced interfaces for dependency graph analysis
export interface DependencyNode {
  id: number;
  dependencies: number[];
  dependents: number[];
  status: string;
  priority: string;
}

export interface CircularDependency {
  cycle: number[];
  description: string;
}

export interface ResolutionOrder {
  order: number[];
  hasCycles: boolean;
  cycles: CircularDependency[];
  totalNodes: number;
  resolvedNodes: number;
}

export interface CriticalPath {
  path: number[];
  length: number;
  estimatedDuration: number;
}

/**
 * Utility function to extract task ID from YAML front-matter or title
 */
export function extractTaskId(body: string, title?: string): number | undefined {
  // First try YAML front-matter
  const yamlData = parseYamlFrontMatter(body);
  if (yamlData.id !== undefined) {
    return yamlData.id;
  }
  
  // Fall back to title format like "[123] Task Title" or "[1.2] Subtask Title"
  if (title) {
    const titleMatch = title.match(/^\[(\d+(?:\.\d+)?)\]/);
    if (titleMatch) {
      const idStr = titleMatch[1];
      if (idStr.includes('.')) {
        // Subtask format like "1.2" - return the subtask ID part
        return parseInt(idStr.split('.')[1], 10);
      } else {
        // Main task format like "123"
        return parseInt(idStr, 10);
      }
    }
  }
  
  return undefined;
}

/**
 * Utility function to extract parent task ID
 */
export function extractParentId(body: string, title?: string): number | undefined {
  // First try YAML front-matter
  const yamlData = parseYamlFrontMatter(body);
  if (yamlData.parent !== undefined) {
    return yamlData.parent;
  }
  
  // Fall back to title format like "[1.2] Subtask Title"
  if (title) {
    const titleMatch = title.match(/^\[(\d+)\.(\d+)\]/);
    if (titleMatch) {
      return parseInt(titleMatch[1], 10);
    }
  }
  
  return undefined;
}