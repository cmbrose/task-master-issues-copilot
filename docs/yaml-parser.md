# YAML Front-matter Parser

The YAML front-matter parser extracts structured data from GitHub issue descriptions, including dependencies, priority, and other metadata fields.

## Features

### Core Parsing Capabilities
- **YAML Front-matter**: Extract `id`, `parent`, `dependencies`, and custom fields
- **Metadata Section**: Parse status, priority, complexity, and other metadata
- **Dependencies Section**: Extract dependency relationships with completion status
- **Required By Section**: Parse reverse dependency relationships
- **Content Sections**: Extract description, details, and test strategy

### Data Extraction
- Robust YAML parsing with error handling
- Array parsing for dependencies
- Boolean completion status for dependencies
- Custom metadata field extraction
- Task hierarchy analysis

## Usage

### Basic Parsing

```typescript
import { parseIssueBody } from './scripts/issue-parser';

const issueBody = `---
id: 42
parent: 100
dependencies: [10, 20, 30]
---

## Description
Implement user authentication

## Dependencies
- [x] #10 Database setup
- [ ] #20 API framework

## Meta
- **Status**: \`in-progress\`
- **Priority**: \`high\``;

const parsed = parseIssueBody(issueBody);
console.log(parsed.yamlFrontMatter.id); // 42
console.log(parsed.metadata.status); // "in-progress"
console.log(parsed.dependencies); // Array of dependency objects
```

### Individual Parsers

```typescript
import { 
  parseYamlFrontMatter,
  parseMetadata,
  parseDependencies,
  parseRequiredBy
} from './scripts/issue-parser';

// Parse only YAML front-matter
const yamlData = parseYamlFrontMatter(issueBody);

// Parse only metadata
const metadata = parseMetadata(issueBody);

// Parse only dependencies
const dependencies = parseDependencies(issueBody);

// Parse only required-by relationships
const requiredBy = parseRequiredBy(issueBody);
```

### Utility Functions

```typescript
import { 
  hasYamlFrontMatter,
  extractTaskId,
  extractParentId
} from './scripts/issue-parser';

// Check if issue has YAML front-matter
const hasYaml = hasYamlFrontMatter(issueBody);

// Extract task ID from YAML or title
const taskId = extractTaskId(issueBody, issueTitle);

// Extract parent task ID
const parentId = extractParentId(issueBody, issueTitle);
```

## Data Structures

### ParsedIssueData
```typescript
interface ParsedIssueData {
  yamlFrontMatter: ParsedYamlFrontMatter;
  metadata: ParsedMetadata;
  dependencies: ParsedDependency[];
  requiredBy: ParsedDependency[];
  description?: string;
  details?: string;
  testStrategy?: string;
  rawBody: string;
}
```

### ParsedYamlFrontMatter
```typescript
interface ParsedYamlFrontMatter {
  id?: number;
  parent?: number;
  dependencies?: number[];
  [key: string]: any;
}
```

### ParsedMetadata
```typescript
interface ParsedMetadata {
  status?: string;
  priority?: string;
  complexity?: string;
  [key: string]: string | undefined;
}
```

### ParsedDependency
```typescript
interface ParsedDependency {
  issueNumber: number;
  completed: boolean;
  title?: string;
}
```

## Integration Examples

### Enhanced Issue Analysis

```typescript
import { parseIssueBody } from './scripts/issue-parser';

function analyzeIssue(issue: GitHubIssue) {
  const parsed = parseIssueBody(issue.body);
  
  // Check if issue is blocked
  const isBlocked = parsed.dependencies.some(dep => !dep.completed);
  
  // Calculate progress
  const progress = parsed.dependencies.length > 0 
    ? (parsed.dependencies.filter(dep => dep.completed).length / parsed.dependencies.length) * 100
    : 100;
  
  return {
    taskId: parsed.yamlFrontMatter.id,
    status: parsed.metadata.status,
    isBlocked,
    progress,
    blockingDependencies: parsed.dependencies.filter(dep => !dep.completed)
  };
}
```

### Dependency Tracking

```typescript
function trackDependencies(issues: GitHubIssue[]) {
  const dependencyGraph = new Map();
  
  for (const issue of issues) {
    const parsed = parseIssueBody(issue.body);
    const dependencies = parsed.dependencies.map(dep => dep.issueNumber);
    
    dependencyGraph.set(issue.number, {
      issue,
      dependencies,
      blocked: dependencies.length > 0
    });
  }
  
  return dependencyGraph;
}
```

### Label Generation

```typescript
function generateLabels(issue: GitHubIssue): string[] {
  const parsed = parseIssueBody(issue.body);
  const labels = ['taskmaster'];
  
  // Add metadata-based labels
  if (parsed.metadata.status) labels.push(`status:${parsed.metadata.status}`);
  if (parsed.metadata.priority) labels.push(`priority:${parsed.metadata.priority}`);
  
  // Add dependency-based labels
  if (parsed.dependencies.length > 0) {
    labels.push('has-dependencies');
    const blocked = parsed.dependencies.some(dep => !dep.completed);
    if (blocked) labels.push('blocked');
  }
  
  return labels;
}
```

## Testing

Run the parser tests:
```bash
npm run test:yaml-parser
```

Run interactive demos:
```bash
npm run demo:issue-parser
npm run demo:enhanced-management
```

## Error Handling

The parser is designed to be resilient:
- Invalid YAML returns empty objects instead of throwing errors
- Missing sections return empty arrays/objects
- Malformed data is silently ignored with warnings
- Type conversion handles both strings and numbers

## Round-trip Compatibility

The parser is fully compatible with the existing YAML front-matter generation:
- Parses all fields generated by `buildIssueBody()`
- Maintains data types and structure
- Supports round-trip workflows (generate → parse → generate)

## Performance

- Optimized regex patterns for section parsing
- Minimal dependencies (only js-yaml for YAML parsing)
- Efficient string processing for large issue bodies
- No external API calls or file I/O