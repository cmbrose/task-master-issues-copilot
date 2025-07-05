#!/bin/bash
# Test script to validate pull request trigger detection functionality

set -e

echo "🧪 Testing Pull Request Trigger Detection"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Test 1: Validate YAML syntax for both workflows
echo "📝 Testing YAML syntax..."
npx js-yaml .github/workflows/taskmaster.yml > /dev/null
echo "✅ taskmaster.yml is valid YAML"
npx js-yaml .github/workflows/taskmaster-generate.yml > /dev/null
echo "✅ taskmaster-generate.yml is valid YAML"

# Test 2: Check for pull_request trigger in comprehensive workflow
echo "🔍 Testing pull request trigger in taskmaster.yml..."
WORKFLOW_MAIN=".github/workflows/taskmaster.yml"

if grep -q "pull_request:" "$WORKFLOW_MAIN"; then
    echo "✅ pull_request trigger found in main workflow"
else
    echo "❌ pull_request trigger missing in main workflow"
    exit 1
fi

# Check for proper pull request configuration
if grep -A 5 "pull_request:" "$WORKFLOW_MAIN" | grep -q "docs/\*\*\.prd\.md"; then
    echo "✅ PRD file path filter configured for pull requests"
else
    echo "❌ PRD file path filter missing for pull requests"
    exit 1
fi

if grep -A 5 "pull_request:" "$WORKFLOW_MAIN" | grep -q "types:.*opened.*synchronize.*reopened"; then
    echo "✅ Pull request types configured correctly"
else
    echo "❌ Pull request types configuration missing or incorrect"
    exit 1
fi

# Test 3: Check for pull_request trigger in generate workflow
echo "🔍 Testing pull request trigger in taskmaster-generate.yml..."
WORKFLOW_GEN=".github/workflows/taskmaster-generate.yml"

if grep -q "pull_request:" "$WORKFLOW_GEN"; then
    echo "✅ pull_request trigger found in generate workflow"
else
    echo "❌ pull_request trigger missing in generate workflow"
    exit 1
fi

# Test 4: Check for dry-run mode detection logic
echo "🎯 Testing dry-run mode detection..."

# Check for dry-run output in determine-mode job
if grep -A 20 "determine-mode:" "$WORKFLOW_MAIN" | grep -q "dry-run:"; then
    echo "✅ Dry-run output found in determine-mode job"
else
    echo "❌ Dry-run output missing in determine-mode job"
    exit 1
fi

# Check for pull_request case in mode detection
if grep -A 10 "pull_request" "$WORKFLOW_MAIN" | grep -q "dry-run=true"; then
    echo "✅ Dry-run mode enabled for pull requests"
else
    echo "❌ Dry-run mode not configured for pull requests"
    exit 1
fi

# Test 5: Check for environment variables configuration
echo "🌍 Testing environment variables..."

if grep -q "TASKMASTER_DRY_RUN:" "$WORKFLOW_MAIN"; then
    echo "✅ TASKMASTER_DRY_RUN environment variable found in main workflow"
else
    echo "❌ TASKMASTER_DRY_RUN environment variable missing in main workflow"
    exit 1
fi

if grep -q "TASKMASTER_DRY_RUN:" "$WORKFLOW_GEN"; then
    echo "✅ TASKMASTER_DRY_RUN environment variable found in generate workflow"
else
    echo "❌ TASKMASTER_DRY_RUN environment variable missing in generate workflow"
    exit 1
fi

# Test 6: Check for proper permissions
echo "🔐 Testing permissions for pull requests..."

if grep -A 5 "permissions:" "$WORKFLOW_MAIN" | grep -q "pull-requests: write"; then
    echo "✅ Pull requests write permission found in main workflow"
else
    echo "❌ Pull requests write permission missing in main workflow"
    exit 1
fi

if grep -A 5 "permissions:" "$WORKFLOW_GEN" | grep -q "pull-requests: write"; then
    echo "✅ Pull requests write permission found in generate workflow"
else
    echo "❌ Pull requests write permission missing in generate workflow"
    exit 1
fi

# Test 7: Check for pull request logging
echo "📋 Testing pull request event logging..."

if grep -A 20 "pull_request" "$WORKFLOW_MAIN" | grep -q "github.event.pull_request.number"; then
    echo "✅ Pull request number logging found"
else
    echo "❌ Pull request number logging missing"
    exit 1
fi

if grep -A 20 "pull_request" "$WORKFLOW_MAIN" | grep -q "DRY-RUN mode"; then
    echo "✅ Dry-run mode logging found"
else
    echo "❌ Dry-run mode logging missing"
    exit 1
fi

# Test 8: Check for conditional execution logic
echo "🔄 Testing conditional execution logic..."

# Check that push events don't set dry-run mode
if grep -A 10 "\"push\"" "$WORKFLOW_MAIN" | grep -q "dry-run=false"; then
    echo "✅ Push events correctly set dry-run=false"
else
    echo "❌ Push events dry-run configuration incorrect"
    exit 1
fi

echo ""
echo "🎉 All Pull Request Trigger Detection tests passed!"
echo ""
echo "Summary:"
echo "✅ YAML syntax validation"
echo "✅ Pull request triggers configured"
echo "✅ PRD path filtering for pull requests"
echo "✅ Pull request types configuration"
echo "✅ Dry-run mode detection logic"
echo "✅ Environment variables setup"
echo "✅ Permissions configuration"
echo "✅ Pull request event logging"
echo "✅ Conditional execution logic"