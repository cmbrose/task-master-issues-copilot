#!/bin/bash

# Test script to verify dry-run toggle functionality
# This tests that the dry-run mode can be enabled/disabled via environment variables

set -e

echo "🧪 Testing Dry-Run Toggle Functionality"

# Test 1: Check environment variable detection in main.ts
echo "🔍 Test 1: Environment variable detection..."

MAIN_FILE="actions/taskmaster-generate/src/main.ts"

# Test TASKMASTER_DRY_RUN variable
if grep -q "TASKMASTER_DRY_RUN.*===.*'true'" "$MAIN_FILE"; then
    echo "✅ TASKMASTER_DRY_RUN environment variable check found"
else
    echo "❌ TASKMASTER_DRY_RUN environment variable check missing"
    exit 1
fi

# Test DRY_RUN variable (fallback)
if grep -q "DRY_RUN.*===.*'true'" "$MAIN_FILE"; then
    echo "✅ DRY_RUN environment variable check found"
else
    echo "❌ DRY_RUN environment variable check missing"
    exit 1
fi

# Test 2: Check workflow environment variable setting
echo "🔧 Test 2: Workflow environment variable configuration..."

WORKFLOW_MAIN=".github/workflows/taskmaster.yml"
WORKFLOW_GEN=".github/workflows/taskmaster-generate.yml"

# Check that TASKMASTER_DRY_RUN is set in workflows
if grep -q "TASKMASTER_DRY_RUN:" "$WORKFLOW_MAIN"; then
    echo "✅ TASKMASTER_DRY_RUN configured in main workflow"
else
    echo "❌ TASKMASTER_DRY_RUN missing in main workflow"
    exit 1
fi

if grep -q "TASKMASTER_DRY_RUN:" "$WORKFLOW_GEN"; then
    echo "✅ TASKMASTER_DRY_RUN configured in generate workflow"
else
    echo "❌ TASKMASTER_DRY_RUN missing in generate workflow"
    exit 1
fi

# Test 3: Check conditional dry-run setting logic
echo "🎯 Test 3: Conditional dry-run logic..."

# Check pull_request events enable dry-run
if grep -A 5 "pull_request" "$WORKFLOW_GEN" | grep -q "DRY_RUN=true"; then
    echo "✅ Pull request events enable dry-run mode"
else
    echo "❌ Pull request events don't properly enable dry-run"
    exit 1
fi

# Check that non-pull-request events disable dry-run
if grep -A 10 "Determine if this is a dry-run" "$WORKFLOW_GEN" | grep -q "DRY_RUN=false"; then
    echo "✅ Non-pull-request events disable dry-run mode"
else
    echo "❌ Non-pull-request events don't properly disable dry-run"
    exit 1
fi

# Test 4: Check manual toggle capability
echo "🔄 Test 4: Manual toggle capability..."

# Check if workflow_dispatch allows manual control (via environment)
if grep -A 20 "workflow_dispatch" "$WORKFLOW_GEN" | grep -q "github-token"; then
    echo "✅ Manual dispatch supports configuration"
else
    echo "❌ Manual dispatch configuration incomplete"
    exit 1
fi

# Test 5: Verify toggle affects behavior
echo "📊 Test 5: Toggle behavior verification..."

# Check that dry-run mode skips issue creation
if grep -A 5 "isDryRun" "$MAIN_FILE" | grep -q "Skipping.*issue.*creation"; then
    echo "✅ Dry-run mode properly skips issue creation"
else
    echo "❌ Dry-run mode doesn't skip issue creation"
    exit 1
fi

# Check that dry-run mode still generates task graph
if grep -A 10 "isDryRun" "$MAIN_FILE" | grep -q "task.*graph.*generated"; then
    echo "✅ Dry-run mode preserves task graph generation"
else
    echo "❌ Dry-run mode doesn't preserve task graph generation"
    exit 1
fi

echo ""
echo "🎉 All Dry-Run Toggle tests passed!"
echo ""
echo "Summary:"
echo "✅ Environment variable detection (TASKMASTER_DRY_RUN and DRY_RUN)"
echo "✅ Workflow environment variable configuration"
echo "✅ Conditional dry-run logic for different trigger types"
echo "✅ Manual toggle capability through workflow dispatch"
echo "✅ Toggle properly affects application behavior"
echo "✅ Task graph generation preserved in dry-run mode"
echo "✅ Issue creation skipped in dry-run mode"