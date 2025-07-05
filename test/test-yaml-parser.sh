#!/bin/bash
# Test YAML Front-matter Parser

set -e

echo "🧪 Testing YAML Front-matter Parser"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Test 1: Basic YAML front-matter parsing
echo "📋 Test 1: Basic YAML front-matter parsing..."
npx ts-node -e "
import { parseYamlFrontMatter } from './scripts/yaml-frontmatter-parser';

const validIssueBody = \`---
id: 123
parent: 456
dependencies: [1, 2, 3]
status: pending
priority: high
complexity: 7.5
---

## Description
This is a test issue with valid YAML front-matter.
\`;

const result = parseYamlFrontMatter(validIssueBody);
if (result.success && result.data?.id === 123) {
  console.log('✅ Basic YAML parsing works');
} else {
  console.log('❌ Basic YAML parsing failed');
  process.exit(1);
}
"

# Test 2: Error handling for invalid YAML
echo "📋 Test 2: Error handling for invalid YAML..."
npx ts-node -e "
import { parseYamlFrontMatter } from './scripts/yaml-frontmatter-parser';

const invalidBody = \`## Description
No YAML front-matter here.\`;

const result = parseYamlFrontMatter(invalidBody);
if (!result.success && result.error?.includes('No YAML front-matter found')) {
  console.log('✅ Error handling works');
} else {
  console.log('❌ Error handling failed');
  process.exit(1);
}
"

# Test 3: Metadata extraction from markdown sections
echo "📋 Test 3: Metadata extraction from markdown..."
npx ts-node -e "
import { extractIssueMetadata } from './scripts/yaml-frontmatter-parser';

const issueWithMeta = \`---
id: 100
---

## Description
Test issue for metadata extraction.

## Meta
- **Status**: \\\`in-progress\\\`
- **Priority**: \\\`high\\\`
- **Complexity**: \\\`9 / 10\\\`
- **Parent Task**: #200
\`;

const result = extractIssueMetadata(issueWithMeta);
if (result.id === 100 && result.complexityFromMeta === 9 && result.parentFromMeta === 200) {
  console.log('✅ Metadata extraction works');
} else {
  console.log('❌ Metadata extraction failed');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(1);
}
"

# Test 4: Validation function
echo "📋 Test 4: Validation function..."
npx ts-node -e "
import { validateFrontMatter } from './scripts/yaml-frontmatter-parser';

const validData = { id: 123, parent: 456, dependencies: [1, 2, 3], status: 'pending', complexity: 7.5 };
const invalidData = { id: -1, complexity: 15 };

const validResult = validateFrontMatter(validData);
const invalidResult = validateFrontMatter(invalidData);

if (validResult.valid && !invalidResult.valid) {
  console.log('✅ Validation works');
} else {
  console.log('❌ Validation failed');
  process.exit(1);
}
"

# Test 5: Real-world issue example
echo "📋 Test 5: Real-world issue example..."
npx ts-node -e "
import { extractIssueMetadata } from './scripts/yaml-frontmatter-parser';

const realIssue = \`---
id: 234
parent: 232
dependencies: [233]
---

## Details

Create parser to extract structured data from issue descriptions, including dependencies, priority, and other metadata fields.

## Meta

- **Status**: \\\`pending\\\`  
- **Complexity**: \\\`7 / 10\\\`  
- **Parent Task**: #232  
- **Required By:**  
  - [ ] #235  
\`;

const result = extractIssueMetadata(realIssue);
if (result.id === 234 && result.parent === 232 && result.dependencies?.includes(233)) {
  console.log('✅ Real-world example works');
} else {
  console.log('❌ Real-world example failed');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(1);
}
"

echo "✅ All YAML Front-matter Parser tests passed!"

echo "✅ YAML Front-matter Parser tests completed successfully!"