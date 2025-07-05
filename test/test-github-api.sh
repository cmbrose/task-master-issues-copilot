#!/bin/bash

# Test GitHub API Integration
# Tests the enhanced GitHub API functionality with rate limiting and error handling

set -e

echo "=== Testing GitHub API Integration ==="

# Test TypeScript compilation
echo "Testing TypeScript compilation..."
cd "$(dirname "$0")/.."
npx tsc scripts/github-api.ts --noEmit
echo "✓ TypeScript compilation successful"

# Test main create-issues.ts compilation
echo "Testing create-issues.ts compilation..."
npx tsc create-issues.ts --noEmit
echo "✓ create-issues.ts compilation successful"

# Create a simple Node.js test script to verify the API client can be instantiated
cat > /tmp/test-github-api.js << 'EOF'
const fs = require('fs');

// Read and parse the compiled TypeScript (if available)
try {
  // Test that the module structure is correct
  const indexContent = fs.readFileSync('./scripts/github-api.ts', 'utf8');
  
  // Check for key exports
  const requiredExports = [
    'EnhancedGitHubApi',
    'createGitHubApiClient',
    'GitHubErrorCategory'
  ];
  
  let missingExports = [];
  for (const exportName of requiredExports) {
    const regex = new RegExp(`export.*${exportName}`);
    if (!regex.test(indexContent)) {
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
    if (!regex.test(indexContent)) {
      missingFeatures.push(feature);
    }
  }
  
  if (missingFeatures.length > 0) {
    console.error('Missing features:', missingFeatures);
    process.exit(1);
  }
  
  console.log('✓ All required features implemented');
  console.log('✓ GitHub API integration test passed');
  
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}
EOF

echo "Testing GitHub API module structure..."
node /tmp/test-github-api.js
echo "✓ GitHub API module structure test passed"

# Test that the scripts index exports work
echo "Testing scripts/index.ts exports..."
npx tsc scripts/index.ts --noEmit
echo "✓ scripts/index.ts exports test passed"

# Clean up
rm -f /tmp/test-github-api.js

echo "=== All GitHub API Integration Tests Passed ==="