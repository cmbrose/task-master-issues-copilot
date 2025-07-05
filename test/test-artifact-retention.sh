#!/bin/bash
set -e

# Test Artifact Retention Configuration
echo "🧪 Testing Artifact Retention Configuration"

REPO_ROOT=$(pwd)

# Test 1: Configuration validation
echo "🔧 Testing configuration validation..."

cd "$REPO_ROOT"

# Test configuration loading
echo "📋 Testing configuration loading..."

# Create test configuration file
cat > test-retention.json << 'EOF'
{
  "taskmaster": {
    "maxArtifactsCount": 15,
    "retentionDays": 45
  }
}
EOF

# Test environment variable loading
export INPUT_MAX_ARTIFACTS_COUNT="20"
export INPUT_RETENTION_DAYS="60" 
export INPUT_GITHUB_TOKEN="test-token" 

# Test configuration with Node.js using ts-node
cat > test-config.ts << 'EOF'
import { loadConfig } from './scripts/config-management';

try {
  const config = loadConfig({
    validate: true,
    baseDir: process.cwd(),
    configPaths: ['test-retention.json']
  }, {
    maxArtifactsCount: parseInt(process.env.INPUT_MAX_ARTIFACTS_COUNT || '0'),
    retentionDays: parseInt(process.env.INPUT_RETENTION_DAYS || '0')
  });
  
  console.log('✅ Configuration loaded successfully');
  console.log(`  • Max artifacts count: ${config.maxArtifactsCount} (expected: 20)`);
  console.log(`  • Retention days: ${config.retentionDays} (expected: 60)`);
  
  if (config.maxArtifactsCount === 20 && config.retentionDays === 60) {
    console.log('✅ Environment variable override working correctly');
  } else {
    console.error('❌ Environment variable override failed');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Configuration loading failed:', (error as Error).message);
  process.exit(1);
}
EOF

npx ts-node test-config.ts

# Test 2: Validate workflow inputs
echo "🔄 Testing workflow input structure..."

# Check if new inputs are in taskmaster-generate.yml
if grep -q "max-artifacts-count:" .github/workflows/taskmaster-generate.yml; then
    echo "✅ max-artifacts-count input found in workflow"
else
    echo "❌ max-artifacts-count input missing from workflow"
    exit 1
fi

if grep -q "retention-days:" .github/workflows/taskmaster-generate.yml; then
    echo "✅ retention-days input found in workflow"
else
    echo "❌ retention-days input missing from workflow"
    exit 1
fi

# Test 3: Validate action configuration
echo "🎯 Testing action configuration..."

# Check action.yml for new inputs
if grep -q "max-artifacts-count:" actions/taskmaster-generate/action.yml; then
    echo "✅ max-artifacts-count input found in action"
else
    echo "❌ max-artifacts-count input missing from action"
    exit 1
fi

if grep -q "retention-days:" actions/taskmaster-generate/action.yml; then
    echo "✅ retention-days input found in action"
else
    echo "❌ retention-days input missing from action"
    exit 1
fi

# Test 4: Validate artifact cleanup action
echo "🧹 Testing artifact cleanup action structure..."

if [[ -f "actions/artifact-cleanup/action.yml" ]]; then
    echo "✅ Artifact cleanup action exists"
    
    if npx js-yaml actions/artifact-cleanup/action.yml > /dev/null; then
        echo "✅ Artifact cleanup action YAML is valid"
    else
        echo "❌ Artifact cleanup action YAML is invalid"
        exit 1
    fi
else
    echo "❌ Artifact cleanup action missing"
    exit 1
fi

# Test 5: Validate cleanup workflow
echo "⏰ Testing cleanup workflow..."

if [[ -f ".github/workflows/artifact-cleanup.yml" ]]; then
    echo "✅ Artifact cleanup workflow exists"
    
    if npx js-yaml .github/workflows/artifact-cleanup.yml > /dev/null; then
        echo "✅ Artifact cleanup workflow YAML is valid"
    else
        echo "❌ Artifact cleanup workflow YAML is invalid"
        exit 1
    fi
    
    if grep -q "schedule:" .github/workflows/artifact-cleanup.yml; then
        echo "✅ Scheduled trigger found in cleanup workflow"
    else
        echo "❌ Scheduled trigger missing from cleanup workflow"
        exit 1
    fi
else
    echo "❌ Artifact cleanup workflow missing"
    exit 1
fi

# Test 6: TypeScript compilation
echo "🔨 Testing TypeScript compilation..."

cd actions/artifact-cleanup
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "✅ Artifact cleanup action TypeScript compiles successfully"
else
    echo "❌ Artifact cleanup action TypeScript compilation failed"
    exit 1
fi

# Clean up test files
cd "$REPO_ROOT"
rm -f test-retention.json test-config.ts

# Unset test environment variables
unset INPUT_MAX_ARTIFACTS_COUNT
unset INPUT_RETENTION_DAYS
unset INPUT_GITHUB_TOKEN

echo ""
echo "🎉 All artifact retention configuration tests passed!"
echo ""
echo "Summary:"
echo "✅ Configuration validation working"
echo "✅ Environment variable override working"
echo "✅ Workflow inputs configured"
echo "✅ Action configuration validated"
echo "✅ Artifact cleanup action structure valid"
echo "✅ Cleanup workflow configured"
echo "✅ TypeScript compilation successful"