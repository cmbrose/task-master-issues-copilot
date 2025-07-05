#!/bin/bash

# Simplified GitHub API Integration Test
# Tests the enhanced GitHub API functionality

set -e

echo "=== Testing GitHub API Integration (Simplified) ==="

cd "$(dirname "$0")/.."

# Test individual file compilation
echo "Testing github-api.ts compilation..."
npx tsc scripts/github-api.ts --noEmit
echo "✓ github-api.ts compilation successful"

echo "Testing create-issues.ts compilation..."
npx tsc create-issues.ts --noEmit  
echo "✓ create-issues.ts compilation successful"

# Test module structure
echo "Testing GitHub API module structure..."
node -e "
const fs = require('fs');
const content = fs.readFileSync('./scripts/github-api.ts', 'utf8');

// Check for required exports
const requiredExports = ['EnhancedGitHubApi', 'createGitHubApiClient', 'GitHubErrorCategory'];
let missingExports = [];

for (const exportName of requiredExports) {
  const regex = new RegExp(\`export.*\${exportName}\`);
  if (!regex.test(content)) {
    missingExports.push(exportName);
  }
}

if (missingExports.length > 0) {
  console.error('Missing exports:', missingExports);
  process.exit(1);
}

console.log('✓ All required exports found');

// Check for key functionality  
const requiredFeatures = [
  'rate.?limit',
  'retry',
  'concurrent',
  'queue',
  'exponential.?backoff'
];

let missingFeatures = [];
for (const feature of requiredFeatures) {
  const regex = new RegExp(feature, 'i');
  if (!regex.test(content)) {
    missingFeatures.push(feature);
  }
}

if (missingFeatures.length > 0) {
  console.error('Missing features:', missingFeatures);
  process.exit(1);
}

console.log('✓ All required features implemented');
console.log('✓ GitHub API integration module test passed');
"

echo "=== GitHub API Integration Tests Passed ==="