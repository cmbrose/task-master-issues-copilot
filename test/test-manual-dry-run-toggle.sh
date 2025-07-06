#!/bin/bash

# Test script for manual dry-run toggle enhancement
# This tests the new workflow input for manual dry-run control

set -e

echo "🧪 Testing Manual Dry-Run Toggle Enhancement"

# Test 1: Check if dry-run input is added to workflow_dispatch
echo "🔧 Test 1: Manual dry-run input configuration..."

WORKFLOW_MAIN=".github/workflows/taskmaster.yml"
WORKFLOW_GEN=".github/workflows/taskmaster-generate.yml"

if grep -A 40 "workflow_dispatch:" "$WORKFLOW_GEN" | grep -q "dry-run:"; then
    echo "✅ Dry-run input found in generate workflow"
else
    echo "❌ Dry-run input missing in generate workflow"
    exit 1
fi

if grep -A 60 "workflow_dispatch:" "$WORKFLOW_MAIN" | grep -q "dry-run:"; then
    echo "✅ Dry-run input found in main workflow"
else
    echo "❌ Dry-run input missing in main workflow"
    exit 1
fi

# Test 2: Check if dry-run input has proper description
echo "📝 Test 2: Input description and configuration..."

if grep -A 5 "dry-run:" "$WORKFLOW_GEN" | grep -q "Enable dry-run mode"; then
    echo "✅ Dry-run input has proper description in generate workflow"
else
    echo "❌ Dry-run input description missing in generate workflow"
    exit 1
fi

if grep -A 5 "dry-run:" "$WORKFLOW_MAIN" | grep -q "Enable dry-run mode"; then
    echo "✅ Dry-run input has proper description in main workflow"
else
    echo "❌ Dry-run input description missing in main workflow"
    exit 1
fi

# Test 3: Check if dry-run input is type boolean with default false
echo "⚙️ Test 3: Input type and default value..."

if grep -A 5 "dry-run:" "$WORKFLOW_GEN" | grep -q "type: boolean" && \
   grep -A 5 "dry-run:" "$WORKFLOW_GEN" | grep -q "default: false"; then
    echo "✅ Dry-run input properly configured as boolean with default false in generate workflow"
else
    echo "❌ Dry-run input configuration incorrect in generate workflow"
    exit 1
fi

if grep -A 5 "dry-run:" "$WORKFLOW_MAIN" | grep -q "type: boolean" && \
   grep -A 5 "dry-run:" "$WORKFLOW_MAIN" | grep -q "default: false"; then
    echo "✅ Dry-run input properly configured as boolean with default false in main workflow"
else
    echo "❌ Dry-run input configuration incorrect in main workflow"
    exit 1
fi

# Test 4: Check if workflow_dispatch dry-run logic is implemented
echo "🎯 Test 4: Manual dry-run detection logic..."

if grep -A 10 "workflow_dispatch.*dry-run" "$WORKFLOW_GEN" | grep -q "Manual DRY-RUN mode enabled"; then
    echo "✅ Manual dry-run detection logic found in generate workflow"
else
    echo "❌ Manual dry-run detection logic missing in generate workflow"
    exit 1
fi

if grep -A 20 "workflow_dispatch" "$WORKFLOW_MAIN" | grep -q "inputs.dry-run"; then
    echo "✅ Manual dry-run usage found in main workflow"
else
    echo "❌ Manual dry-run usage missing in main workflow"
    exit 1
fi

# Test 5: Check if dry-run parameter is logged
echo "📋 Test 5: Parameter logging..."

if grep -A 10 "Parameters:" "$WORKFLOW_GEN" | grep -q "Dry-run mode"; then
    echo "✅ Dry-run parameter logged in generate workflow"
else
    echo "❌ Dry-run parameter logging missing in generate workflow"
    exit 1
fi

if grep -A 10 "Parameters:" "$WORKFLOW_MAIN" | grep -q "Dry-run mode"; then
    echo "✅ Dry-run parameter logged in main workflow"
else
    echo "❌ Dry-run parameter logging missing in main workflow"
    exit 1
fi

echo ""
echo "🎉 All Manual Dry-Run Toggle Enhancement tests passed!"
echo ""
echo "Enhancement Summary:"
echo "✅ Manual dry-run input added to workflow_dispatch triggers"
echo "✅ Proper input description and configuration"
echo "✅ Boolean type with secure default (false)"
echo "✅ Manual dry-run detection logic implemented"
echo "✅ Parameter logging includes dry-run setting"
echo "✅ Consistent implementation across both workflows"
echo ""
echo "🔧 Usage: Users can now manually enable dry-run mode via GitHub UI"
echo "   when running 'Run workflow' by checking the dry-run checkbox"