#!/bin/bash
set -e

# Test Artifact Cleanup Functionality
echo "🧹 Testing Artifact Cleanup Functionality"

REPO_ROOT=$(pwd)

# Test the artifact cleanup action structure
echo "📦 Testing artifact cleanup action structure..."

cd "$REPO_ROOT/actions/artifact-cleanup"

# Test package.json exists and has correct dependencies
if [[ -f "package.json" ]]; then
    echo "✅ package.json exists"
    
    if grep -q "@actions/core" package.json && grep -q "@actions/github" package.json; then
        echo "✅ Required dependencies found"
    else
        echo "❌ Required dependencies missing"
        exit 1
    fi
else
    echo "❌ package.json missing"
    exit 1
fi

# Test TypeScript compilation
echo "🔨 Testing TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test action.yml structure
echo "🎯 Testing action.yml structure..."
if [[ -f "action.yml" ]]; then
    echo "✅ action.yml exists"
    
    # Check for required inputs
    required_inputs=("github-token" "max-artifacts-count" "retention-days" "dry-run" "preserve-successful-runs" "artifact-name-pattern")
    for input in "${required_inputs[@]}"; do
        if grep -q "$input:" action.yml; then
            echo "✅ Input '$input' found"
        else
            echo "❌ Input '$input' missing"
            exit 1
        fi
    done
    
    # Check for required outputs
    required_outputs=("artifacts-deleted" "artifacts-preserved" "cleanup-summary" "dry-run-mode")
    for output in "${required_outputs[@]}"; do
        if grep -q "$output:" action.yml; then
            echo "✅ Output '$output' found"
        else
            echo "❌ Output '$output' missing"
            exit 1
        fi
    done
else
    echo "❌ action.yml missing"
    exit 1
fi

cd "$REPO_ROOT"

# Test the cleanup workflow
echo "⏰ Testing cleanup workflow structure..."

if [[ -f ".github/workflows/artifact-cleanup.yml" ]]; then
    echo "✅ Cleanup workflow exists"
    
    # Check for schedule trigger
    if grep -q "schedule:" .github/workflows/artifact-cleanup.yml; then
        echo "✅ Scheduled trigger found"
    else
        echo "❌ Scheduled trigger missing"
        exit 1
    fi
    
    # Check for manual dispatch
    if grep -q "workflow_dispatch:" .github/workflows/artifact-cleanup.yml; then
        echo "✅ Manual dispatch trigger found"
    else
        echo "❌ Manual dispatch trigger missing"
        exit 1
    fi
    
    # Check for required permissions
    if grep -q "actions: write" .github/workflows/artifact-cleanup.yml; then
        echo "✅ Required permissions found"
    else
        echo "❌ Required permissions missing"
        exit 1
    fi
else
    echo "❌ Cleanup workflow missing"
    exit 1
fi

# Test enhanced taskmaster-generate workflow
echo "📝 Testing enhanced taskmaster-generate workflow..."

if grep -q "max-artifacts-count:" .github/workflows/taskmaster-generate.yml; then
    echo "✅ max-artifacts-count input found in taskmaster-generate workflow"
else
    echo "❌ max-artifacts-count input missing from taskmaster-generate workflow"
    exit 1
fi

if grep -q "retention-days:" .github/workflows/taskmaster-generate.yml; then
    echo "✅ retention-days input found in taskmaster-generate workflow"
else
    echo "❌ retention-days input missing from taskmaster-generate workflow"
    exit 1
fi

# Test enhanced taskmaster-generate action
echo "🎯 Testing enhanced taskmaster-generate action..."

if grep -q "max-artifacts-count:" actions/taskmaster-generate/action.yml; then
    echo "✅ max-artifacts-count input found in taskmaster-generate action"
else
    echo "❌ max-artifacts-count input missing from taskmaster-generate action"
    exit 1
fi

if grep -q "retention-days:" actions/taskmaster-generate/action.yml; then
    echo "✅ retention-days input found in taskmaster-generate action"
else
    echo "❌ retention-days input missing from taskmaster-generate action"
    exit 1
fi

if grep -q "metadata-retention-days:" actions/taskmaster-generate/action.yml; then
    echo "✅ retention metadata output found in taskmaster-generate action"
else
    echo "❌ retention metadata output missing from taskmaster-generate action"
    exit 1
fi

# Test configuration management enhancements
echo "🔧 Testing configuration management enhancements..."

if grep -q "maxArtifactsCount" scripts/config-management.ts; then
    echo "✅ maxArtifactsCount found in configuration management"
else
    echo "❌ maxArtifactsCount missing from configuration management"
    exit 1
fi

if grep -q "retentionDays" scripts/config-management.ts; then
    echo "✅ retentionDays found in configuration management"
else
    echo "❌ retentionDays missing from configuration management"
    exit 1
fi

# Test validation rules
if grep -q "Max artifacts count must be a number" scripts/config-management.ts; then
    echo "✅ Validation rule for max artifacts count found"
else
    echo "❌ Validation rule for max artifacts count missing"
    exit 1
fi

if grep -q "Retention days must be a number" scripts/config-management.ts; then
    echo "✅ Validation rule for retention days found"
else
    echo "❌ Validation rule for retention days missing"
    exit 1
fi

echo ""
echo "🎉 All artifact cleanup functionality tests passed!"
echo ""
echo "Summary:"
echo "✅ Artifact cleanup action structure validated"
echo "✅ TypeScript compilation successful"
echo "✅ Action inputs and outputs configured"
echo "✅ Cleanup workflow properly configured"
echo "✅ Enhanced taskmaster-generate workflow"
echo "✅ Enhanced taskmaster-generate action"
echo "✅ Configuration management enhanced"
echo "✅ Validation rules implemented"
echo ""
echo "🚀 Ready for deployment and testing!"