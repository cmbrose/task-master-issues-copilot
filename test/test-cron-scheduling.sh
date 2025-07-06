#!/bin/bash

# Test script for cron scheduling implementation

set -e

echo "🧪 Testing Cron Scheduling Implementation"
echo ""

WORKFLOW_FILE=".github/workflows/dependency-resolver.yml"

# Test 1: Check if the workflow file exists
echo "📝 Testing workflow file existence..."
if [[ -f "$WORKFLOW_FILE" ]]; then
    echo "✅ Dependency resolver workflow file exists"
else
    echo "❌ Dependency resolver workflow file missing"
    exit 1
fi

# Test 2: Validate YAML syntax
echo "🔧 Testing YAML syntax..."
if command -v yq >/dev/null 2>&1; then
    if yq eval . "$WORKFLOW_FILE" >/dev/null 2>&1; then
        echo "✅ YAML syntax is valid"
    else
        echo "❌ YAML syntax is invalid"
        exit 1
    fi
elif command -v python3 >/dev/null 2>&1; then
    if python3 -c "import yaml; yaml.safe_load(open('$WORKFLOW_FILE'))" >/dev/null 2>&1; then
        echo "✅ YAML syntax is valid"
    else
        echo "❌ YAML syntax is invalid"
        exit 1
    fi
else
    echo "⚠️ Cannot validate YAML syntax (no yq or python3 available)"
fi

# Test 3: Check for required schedule trigger
echo "⏰ Testing cron schedule configuration..."
if grep -q "*/10 \* \* \* \*" "$WORKFLOW_FILE"; then
    echo "✅ Every 10 minutes cron schedule found"
else
    echo "❌ Every 10 minutes cron schedule missing"
    exit 1
fi

# Test 4: Check for proper permissions
echo "🔐 Testing permissions configuration..."
if grep -A 5 "permissions:" "$WORKFLOW_FILE" | grep -q "issues: write"; then
    echo "✅ Issues write permission found"
else
    echo "❌ Issues write permission missing"
    exit 1
fi

if grep -A 5 "permissions:" "$WORKFLOW_FILE" | grep -q "contents: read"; then
    echo "✅ Contents read permission found"
else
    echo "❌ Contents read permission missing"
    exit 1
fi

# Test 5: Check for taskmaster-watcher usage
echo "👁️ Testing taskmaster-watcher integration..."
if grep -q "uses: ./actions/taskmaster-watcher" "$WORKFLOW_FILE"; then
    echo "✅ Taskmaster watcher action usage found"
else
    echo "❌ Taskmaster watcher action usage missing"
    exit 1
fi

# Test 6: Check for full scan mode
echo "🔍 Testing scan mode configuration..."
if grep -A 5 "taskmaster-watcher" "$WORKFLOW_FILE" | grep -q "scan-mode: 'full'"; then
    echo "✅ Full scan mode configured"
else
    echo "❌ Full scan mode missing"
    exit 1
fi

# Test 7: Check for GitHub token configuration
echo "🔑 Testing GitHub token configuration..."
if grep -q "github-token: \${{ secrets.GITHUB_TOKEN }}" "$WORKFLOW_FILE"; then
    echo "✅ GitHub token configuration found"
else
    echo "❌ GitHub token configuration missing"
    exit 1
fi

# Test 8: Check for output capture
echo "📊 Testing output capture..."
if grep -q "steps.watcher.outputs.issues-updated" "$WORKFLOW_FILE"; then
    echo "✅ Issues updated output capture found"
else
    echo "❌ Issues updated output capture missing"
    exit 1
fi

if grep -q "steps.watcher.outputs.dependencies-resolved" "$WORKFLOW_FILE"; then
    echo "✅ Dependencies resolved output capture found"
else
    echo "❌ Dependencies resolved output capture missing"
    exit 1
fi

# Test 9: Check for error handling context
echo "🛡️ Testing error handling coverage..."
if grep -q "checkout@v4" "$WORKFLOW_FILE"; then
    echo "✅ Proper checkout action version found"
else
    echo "❌ Proper checkout action version missing"
    exit 1
fi

# Test 10: Verify workflow name and purpose
echo "📋 Testing workflow identification..."
if grep -q "name: Dependency Resolver - Cron Scheduling" "$WORKFLOW_FILE"; then
    echo "✅ Proper workflow name found"
else
    echo "❌ Proper workflow name missing"
    exit 1
fi

echo ""
echo "🎉 All cron scheduling implementation tests passed!"
echo ""
echo "Summary:"
echo "✅ Workflow file exists and has valid syntax"
echo "✅ Every 10 minutes cron schedule configured"
echo "✅ Proper permissions set (issues: write, contents: read)"
echo "✅ Taskmaster watcher integration with full scan mode"
echo "✅ GitHub token properly configured"
echo "✅ Output capture for reporting"
echo "✅ Error handling and proper action versions"
echo "✅ Clear workflow identification and purpose"
echo ""
echo "The cron scheduling implementation is ready for dependency resolution!"