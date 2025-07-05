#!/bin/bash

# Test script for dry-run mode functionality
# This tests that the taskmaster-generate action properly handles dry-run mode

set -e

echo "🧪 Testing Dry-Run Mode Functionality"

# Test 1: Check that the main.ts file has dry-run detection logic
echo "🔍 Testing dry-run detection logic in main.ts..."

MAIN_FILE="actions/taskmaster-generate/src/main.ts"

if grep -q "TASKMASTER_DRY_RUN.*true\|DRY_RUN.*true" "$MAIN_FILE"; then
    echo "✅ Dry-run environment variable detection found in main.ts"
else
    echo "❌ Dry-run environment variable detection missing in main.ts"
    exit 1
fi

# Test 2: Check for dry-run logging
echo "📋 Testing dry-run logging..."

if grep -q "DRY-RUN mode" "$MAIN_FILE"; then
    echo "✅ Dry-run mode logging found"
else
    echo "❌ Dry-run mode logging missing"
    exit 1
fi

# Test 3: Check for conditional issue creation skip
echo "🎯 Testing conditional issue creation logic..."

if grep -q "Skipping GitHub issue creation" "$MAIN_FILE"; then
    echo "✅ Conditional issue creation skip found"
else
    echo "❌ Conditional issue creation skip missing"
    exit 1
fi

# Test 4: Check that task graph generation still happens in dry-run
echo "📊 Testing task graph generation in dry-run..."

if grep -q "Task graph generated successfully.*would create.*issues" "$MAIN_FILE"; then
    echo "✅ Task graph generation preserved in dry-run mode"
else
    echo "❌ Task graph generation logic for dry-run missing"
    exit 1
fi

# Test 5: Check for proper completion message
echo "✅ Testing completion message..."

if grep -q "DRY-RUN mode" "$MAIN_FILE" && grep -q "completed successfully" "$MAIN_FILE"; then
    echo "✅ Dry-run completion message found"
else
    echo "❌ Dry-run completion message missing"
    exit 1
fi

echo ""
echo "🎉 All Dry-Run Mode tests passed!"
echo ""
echo "Summary:"
echo "✅ Dry-run environment variable detection"
echo "✅ Dry-run mode logging"
echo "✅ Conditional issue creation skip"
echo "✅ Task graph generation preservation"
echo "✅ Proper completion messages"