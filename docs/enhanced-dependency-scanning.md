# Enhanced Dependency Scanning Logic

This document describes the enhanced dependency scanning logic implemented in Issue #245, which provides advanced algorithms for parsing task dependencies, maintaining dependency graphs, and automatically detecting when tasks become unblocked.

## Features

### 1. Advanced Dependency Graph Analysis

The `DependencyGraphAnalyzer` class provides sophisticated algorithms for analyzing complex dependency relationships:

```typescript
import { DependencyGraphAnalyzer, parseIssueBody } from '@scripts/issue-parser';

// Build dependency graph from parsed issues
const graph = DependencyGraphAnalyzer.buildDependencyGraph(parsedIssues);

// Detect circular dependencies
const cycles = DependencyGraphAnalyzer.detectCircularDependencies(graph);

// Get optimized resolution order with priority consideration
const order = DependencyGraphAnalyzer.getDependencyResolutionOrder(graph);
```

### 2. Circular Dependency Detection

Automatically detects and reports circular dependencies in the task graph:

```typescript
// Returns array of circular dependencies with detailed descriptions
const cycles = DependencyGraphAnalyzer.detectCircularDependencies(graph);

if (cycles.length > 0) {
  console.log(`Found ${cycles.length} circular dependencies:`);
  cycles.forEach(cycle => {
    console.log(`- ${cycle.description}`);
  });
}
```

### 3. Priority-Based Resolution Ordering

Dependencies are resolved in order of priority, ensuring critical tasks are unblocked first:

```typescript
const resolutionOrder = DependencyGraphAnalyzer.getDependencyResolutionOrder(graph);

// Priority order: critical > high > medium > low > trivial
// Higher priority tasks are processed first when dependencies are resolved
```

### 4. Efficient Unblockable Issue Detection

Optimized algorithm for finding which issues would be unblocked by resolving specific dependencies:

```typescript
// Find all issues that would be unblocked if issues [10, 20, 30] are resolved
const unblockableIssues = DependencyGraphAnalyzer.findUnblockableIssues(graph, [10, 20, 30]);
```

### 5. Critical Path Analysis

Calculate the critical path through the dependency graph to identify the longest sequence of dependent tasks:

```typescript
const criticalPath = DependencyGraphAnalyzer.calculateCriticalPath(graph);

console.log(`Critical path: ${criticalPath.path.map(id => `#${id}`).join(' → ')}`);
console.log(`Length: ${criticalPath.length} tasks`);
console.log(`Estimated duration: ${criticalPath.estimatedDuration} time units`);
```

### 6. Batch Processing Optimization

Enhanced batch processing for better performance with large dependency graphs:

- Issues are processed in dependency resolution order
- Batch size optimization (10-15 issues per batch)
- Parallel processing with Promise.allSettled for error resilience
- Performance metrics tracking

### 7. Performance Monitoring

Comprehensive performance metrics for monitoring dependency resolution:

```typescript
interface PerformanceMetrics {
  processingTimeMs: number;
  issuesScanned: number;
  dependencyGraphSize: number;
  cyclesDetected: number;
}
```

## Integration with Taskmaster Watcher

The enhanced dependency scanning logic is integrated into the Taskmaster Watcher action:

### Webhook Mode (Issue Closed Events)

```typescript
// Enhanced webhook processing with batch optimization
const { unblockableIssues, metrics } = await findUnblockableIssuesBatch(
  githubApi, 
  [closedIssue.number]
);

console.log(`Found ${unblockableIssues.length} unblockable issues`);
console.log(`Processed ${metrics.issuesScanned} issues in ${metrics.processingTimeMs}ms`);
```

### Full Scan Mode (Scheduled Runs)

```typescript
// Full dependency graph analysis with resolution ordering
const graph = DependencyGraphAnalyzer.buildDependencyGraph(parsedIssues);
const resolutionOrder = DependencyGraphAnalyzer.getDependencyResolutionOrder(graph);

// Process issues in optimal order
const issuesToProcess = resolutionOrder.order
  .map(id => openIssues.find(issue => issue.number === id))
  .filter(Boolean);
```

## Error Handling and Recovery

Enhanced error handling with graceful degradation:

- **Malformed YAML**: Issues with invalid YAML front-matter are skipped with warnings
- **Missing Dependencies**: References to non-existent issues are handled gracefully
- **Circular Dependencies**: Detected and reported without breaking the resolution process
- **API Failures**: Batch processing with individual error isolation

## Performance Characteristics

The enhanced dependency scanning logic is optimized for:

- **Large Graphs**: Efficiently handles repositories with 500+ tasks
- **Complex Dependencies**: Supports deeply nested and interconnected dependency graphs
- **Real-time Processing**: Webhook mode processes individual changes in <5 seconds
- **Batch Operations**: Full scans complete in under 30 seconds for typical repositories

## Testing Coverage

Comprehensive test suite covering:

- ✅ Basic dependency graph building
- ✅ Circular dependency detection
- ✅ Priority-based resolution ordering
- ✅ Unblockable issue detection
- ✅ Critical path calculation
- ✅ Large-scale graph processing (100+ nodes)
- ✅ Error handling with malformed data
- ✅ Performance validation

## Usage Examples

### Simple Dependency Analysis

```typescript
import { parseIssueBody, DependencyGraphAnalyzer } from '@scripts/issue-parser';

// Parse issue bodies
const parsedIssues = issues.map(issue => parseIssueBody(issue.body));

// Build and analyze dependency graph
const graph = DependencyGraphAnalyzer.buildDependencyGraph(parsedIssues);
const cycles = DependencyGraphAnalyzer.detectCircularDependencies(graph);
const order = DependencyGraphAnalyzer.getDependencyResolutionOrder(graph);

console.log(`Graph size: ${graph.size} nodes`);
console.log(`Cycles detected: ${cycles.length}`);
console.log(`Resolution order: ${order.order.join(' → ')}`);
```

### Finding Critical Bottlenecks

```typescript
// Identify critical path and potential bottlenecks
const criticalPath = DependencyGraphAnalyzer.calculateCriticalPath(graph);

console.log('Critical path issues (potential bottlenecks):');
criticalPath.path.forEach(issueId => {
  const node = graph.get(issueId);
  console.log(`- Issue #${issueId}: ${node?.dependents.length} dependents`);
});
```

### Batch Unblocking Simulation

```typescript
// Simulate what would happen if multiple issues are resolved
const candidateIssues = [100, 101, 102];
const wouldUnblock = DependencyGraphAnalyzer.findUnblockableIssues(graph, candidateIssues);

console.log(`Resolving issues ${candidateIssues.join(', ')} would unblock:`);
wouldUnblock.forEach(issueId => console.log(`- Issue #${issueId}`));
```

## Migration from Basic Logic

The enhanced dependency scanning logic is backward compatible with existing implementations. Existing code will continue to work, with improved performance and additional capabilities available through the new `DependencyGraphAnalyzer` class.

## Configuration

No additional configuration is required. The enhanced logic automatically activates when the new algorithms are available and falls back to basic parsing when needed.

## Monitoring and Metrics

Performance metrics are automatically logged in the GitHub Actions workflow:

```
Found 15 issues that could be unblocked (scanned 127 issues in 245ms)
Dependency graph analysis: 45 nodes, 42/45 resolvable
```

The enhanced dependency scanning logic provides a robust foundation for complex dependency management scenarios while maintaining compatibility with existing workflows.