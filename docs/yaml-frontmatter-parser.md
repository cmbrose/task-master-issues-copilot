# YAML Front-matter Parser

This module provides functionality to parse YAML front-matter from GitHub issue descriptions and extract structured metadata.

## Features

- **YAML Front-matter Parsing**: Extract structured data from YAML front-matter blocks
- **Markdown Section Parsing**: Parse metadata from markdown sections (e.g., Meta section)
- **Hybrid Extraction**: Combine YAML and markdown data with proper precedence
- **Validation**: Validate parsed data with comprehensive error reporting
- **Error Handling**: Robust error handling for malformed YAML or missing data

## Supported Fields

The parser can extract the following metadata fields:

- `id`: Task/issue ID (number)
- `parent`: Parent issue number (number)
- `dependencies`: Array of dependency task IDs (number[])
- `status`: Current status (string)
- `priority`: Priority level (string)
- `complexity`: Complexity score 0-10 (number)

## Usage

```typescript
import { parseYamlFrontMatter, extractIssueMetadata, validateFrontMatter } from './scripts/yaml-frontmatter-parser';

// Parse YAML front-matter only
const result = parseYamlFrontMatter(issueBody);
if (result.success) {
  console.log('Parsed data:', result.data);
}

// Extract comprehensive metadata (YAML + markdown sections)
const metadata = extractIssueMetadata(issueBody);
console.log('Full metadata:', metadata);

// Validate parsed data
const validation = validateFrontMatter(metadata);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}
```

## YAML Front-matter Format

```yaml
---
id: 123
parent: 456
dependencies: [1, 2, 3]
status: pending
priority: high
complexity: 7.5
---
```

## Markdown Meta Section Format

```markdown
## Meta

- **Status**: `pending`
- **Priority**: `high`
- **Complexity**: `8 / 10`
- **Parent Task**: #232
```

## Data Precedence

When both YAML front-matter and markdown sections contain the same field:

1. **YAML front-matter** takes precedence
2. **Markdown sections** are used as fallback
3. Both sources are preserved in the result for reference

## Testing

Run the YAML parser tests:

```bash
npm run test:yaml-parser
```

The test suite covers:
- Valid YAML front-matter parsing
- Error handling for invalid YAML
- Metadata extraction from markdown sections
- Validation functions
- Real-world issue examples
- Edge cases and error conditions