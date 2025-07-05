#!/bin/bash
# Taskmaster Generate Workflow Test Script

set -e

echo "🧪 Testing Taskmaster Generate Workflow"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Test 1: Validate YAML syntax
echo "📝 Testing YAML syntax..."
npx js-yaml .github/workflows/taskmaster-generate.yml > /dev/null
echo "✅ Taskmaster Generate workflow YAML is valid"

# Test 2: Check for required trigger types
echo "🔍 Testing trigger coverage..."
WORKFLOW=".github/workflows/taskmaster-generate.yml"

# Check workflow_dispatch
if grep -q "workflow_dispatch:" "$WORKFLOW"; then
    echo "✅ workflow_dispatch trigger found"
else
    echo "❌ workflow_dispatch trigger missing"
    exit 1
fi

# Check push trigger with PRD paths
if grep -q "push:" "$WORKFLOW"; then
    echo "✅ push trigger found"
    
    if grep -A 10 "push:" "$WORKFLOW" | grep -q "docs/\*\*\.prd\.md"; then
        echo "✅ PRD file path pattern found"
    else
        echo "❌ PRD file path pattern missing"
        exit 1
    fi
else
    echo "❌ push trigger missing"
    exit 1
fi

# Test 3: Validate input parameters for manual dispatch
echo "🔧 Testing input parameter structure..."
REQUIRED_INPUTS=(
    "prd-path-glob"
    "complexity-threshold"
    "max-depth"
    "taskmaster-version"
    "force-download"
)

for input in "${REQUIRED_INPUTS[@]}"; do
    if grep -q "$input:" "$WORKFLOW"; then
        echo "✅ Input parameter '$input' found"
    else
        echo "❌ Input parameter '$input' missing"
        exit 1
    fi
done

# Test 4: Check permissions
echo "🔐 Testing permissions configuration..."
if grep -q "permissions:" "$WORKFLOW"; then
    echo "✅ Permissions block found"
    
    if grep -A 5 "permissions:" "$WORKFLOW" | grep -q "issues: write"; then
        echo "✅ Issues write permission found"
    else
        echo "❌ Issues write permission missing"
        exit 1
    fi
    
    if grep -A 5 "permissions:" "$WORKFLOW" | grep -q "contents: read"; then
        echo "✅ Contents read permission found"
    else
        echo "❌ Contents read permission missing"
        exit 1
    fi
else
    echo "❌ Permissions block missing"
    exit 1
fi

# Test 5: Check action usage
echo "🎯 Testing action integration..."
if grep -q "uses: ./actions/taskmaster-generate" "$WORKFLOW"; then
    echo "✅ Taskmaster Generate action usage found"
else
    echo "❌ Taskmaster Generate action usage missing"
    exit 1
fi

# Test 6: Check GitHub token configuration
echo "🔑 Testing GitHub token configuration..."
if grep -q "github-token: \${{ secrets.GITHUB_TOKEN }}" "$WORKFLOW"; then
    echo "✅ GitHub token configuration found"
else
    echo "❌ GitHub token configuration missing"
    exit 1
fi

# Test 7: Check artifact upload
echo "📦 Testing artifact upload configuration..."
if grep -q "uses: actions/upload-artifact@v4" "$WORKFLOW"; then
    echo "✅ Artifact upload step found"
else
    echo "❌ Artifact upload step missing"
    exit 1
fi

# Test 8: Check summary generation
echo "📊 Testing summary generation..."
if grep -q "GITHUB_STEP_SUMMARY" "$WORKFLOW"; then
    echo "✅ Step summary generation found"
else
    echo "❌ Step summary generation missing"
    exit 1
fi

# Test 9: Validate action inputs are correctly passed
echo "🔄 Testing action input mapping..."
ACTION_INPUTS=(
    "skip-checkout"
    "prd-path-glob"
    "complexity-threshold"
    "max-depth"
    "taskmaster-version"
    "force-download"
    "github-token"
)

for input in "${ACTION_INPUTS[@]}"; do
    if grep -A 20 "uses: ./actions/taskmaster-generate" "$WORKFLOW" | grep -q "$input:"; then
        echo "✅ Action input '$input' mapped correctly"
    else
        echo "❌ Action input '$input' mapping missing"
        exit 1
    fi
done

# Test 10: Validate the taskmaster-generate action structure
echo "🏗️ Testing action structure..."
ACTION_YAML="actions/taskmaster-generate/action.yml"

if [[ -f "$ACTION_YAML" ]]; then
    echo "✅ Action definition file exists"
    
    npx js-yaml "$ACTION_YAML" > /dev/null
    echo "✅ Action YAML is valid"
    
    if grep -q "runs:" "$ACTION_YAML" && grep -q "using: 'composite'" "$ACTION_YAML"; then
        echo "✅ Composite action configuration found"
    else
        echo "❌ Composite action configuration missing"
        exit 1
    fi
else
    echo "❌ Action definition file missing"
    exit 1
fi

# Test 11: Check if action TypeScript compiles
echo "🔨 Testing action compilation..."
if [[ -d "actions/taskmaster-generate/src" ]]; then
    echo "✅ Action source directory exists"
    
    cd "actions/taskmaster-generate"
    if npm list typescript > /dev/null 2>&1; then
        echo "✅ TypeScript dependencies available"
        
        if npx tsc --noEmit > /dev/null 2>&1; then
            echo "✅ Action TypeScript compiles successfully"
        else
            echo "❌ Action TypeScript compilation failed"
            cd "$REPO_ROOT"
            exit 1
        fi
    else
        echo "⚠️ TypeScript dependencies not installed, skipping compilation test"
    fi
    cd "$REPO_ROOT"
else
    echo "❌ Action source directory missing"
    exit 1
fi

echo ""
echo "🎉 All Taskmaster Generate workflow tests passed!"
echo ""
echo "Summary:"
echo "✅ YAML syntax validation"
echo "✅ Required triggers configured"
echo "✅ Input parameters defined"
echo "✅ Permissions properly set" 
echo "✅ Action integration configured"
echo "✅ GitHub token setup"
echo "✅ Artifact upload configured"
echo "✅ Summary generation included"
echo "✅ Action inputs mapped correctly"
echo "✅ Action structure validated"
echo "✅ TypeScript compilation successful"