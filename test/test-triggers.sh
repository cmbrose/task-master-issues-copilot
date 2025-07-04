#!/bin/bash
# Trigger Configuration Validation Script

set -e

echo "🧪 Testing Trigger Configuration"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Test 1: Validate YAML syntax
echo "📝 Testing YAML syntax..."
npx js-yaml .github/workflows/taskmaster.yml > /dev/null
echo "✅ Main workflow YAML is valid"

npx js-yaml .github/workflows/taskmaster-example.yml > /dev/null
echo "✅ Example workflow YAML is valid"

# Test 2: Check for required trigger types
echo "🔍 Testing trigger coverage..."
MAIN_WORKFLOW=".github/workflows/taskmaster.yml"

# Check workflow_dispatch
if grep -q "workflow_dispatch:" "$MAIN_WORKFLOW"; then
    echo "✅ workflow_dispatch trigger found"
else
    echo "❌ workflow_dispatch trigger missing"
    exit 1
fi

# Check push trigger
if grep -q "push:" "$MAIN_WORKFLOW"; then
    echo "✅ push trigger found"
else
    echo "❌ push trigger missing"
    exit 1
fi

# Check issue_comment trigger
if grep -q "issue_comment:" "$MAIN_WORKFLOW"; then
    echo "✅ issue_comment trigger found"
else
    echo "❌ issue_comment trigger missing"
    exit 1
fi

# Check issues trigger
if grep -q "issues:" "$MAIN_WORKFLOW"; then
    echo "✅ issues trigger found"
else
    echo "❌ issues trigger missing"
    exit 1
fi

# Check schedule trigger
if grep -q "schedule:" "$MAIN_WORKFLOW"; then
    echo "✅ schedule trigger found"
else
    echo "❌ schedule trigger missing"
    exit 1
fi

# Test 3: Validate input parameters
echo "🔧 Testing input parameter structure..."
REQUIRED_INPUTS=(
    "complexity-threshold"
    "max-depth"
    "prd-path-glob"
    "breakdown-max-depth"
    "action-mode"
    "scan-mode"
    "taskmaster-version"
    "force-download"
)

for input in "${REQUIRED_INPUTS[@]}"; do
    if grep -q "$input:" "$MAIN_WORKFLOW"; then
        echo "✅ Input parameter '$input' found"
    else
        echo "❌ Input parameter '$input' missing"
        exit 1
    fi
done

# Test 4: Check for input validation
echo "🛡️ Testing input validation..."
if grep -q "validate-inputs:" "$MAIN_WORKFLOW"; then
    echo "✅ Input validation job found"
else
    echo "❌ Input validation job missing"
    exit 1
fi

# Test 5: Check permissions
echo "🔐 Testing permissions configuration..."
if grep -q "permissions:" "$MAIN_WORKFLOW"; then
    echo "✅ Permissions block found"
    
    if grep -A 5 "permissions:" "$MAIN_WORKFLOW" | grep -q "issues: write"; then
        echo "✅ Issues write permission found"
    else
        echo "❌ Issues write permission missing"
        exit 1
    fi
    
    if grep -A 5 "permissions:" "$MAIN_WORKFLOW" | grep -q "contents: read"; then
        echo "✅ Contents read permission found"
    else
        echo "❌ Contents read permission missing"
        exit 1
    fi
else
    echo "❌ Permissions block missing"
    exit 1
fi

# Test 6: Check mode detection logic
echo "🎯 Testing mode detection..."
if grep -q "determine-mode:" "$MAIN_WORKFLOW"; then
    echo "✅ Mode detection job found"
else
    echo "❌ Mode detection job missing"
    exit 1
fi

# Test 7: Test breakdown comment filtering
echo "💬 Testing breakdown comment filtering..."
if grep -q "check-breakdown-comment:" "$MAIN_WORKFLOW"; then
    echo "✅ Breakdown comment filtering found"
else
    echo "❌ Breakdown comment filtering missing"
    exit 1
fi

# Test 8: Validate schedule cron expressions
echo "⏰ Testing cron expressions..."
CRON_PATTERNS=(
    "\*/10 9-18 \* \* 1-5"  # Business hours
    "0 \* \* \* \*"         # Hourly
)

for pattern in "${CRON_PATTERNS[@]}"; do
    if grep -q "$pattern" "$MAIN_WORKFLOW"; then
        echo "✅ Cron pattern '$pattern' found"
    else
        echo "❌ Cron pattern '$pattern' missing"
        exit 1
    fi
done

echo ""
echo "🎉 All trigger configuration tests passed!"
echo ""
echo "Summary:"
echo "✅ YAML syntax validation"
echo "✅ All required triggers configured"
echo "✅ Input parameters defined"
echo "✅ Input validation implemented"
echo "✅ Permissions properly set"
echo "✅ Mode detection logic"
echo "✅ Comment filtering"
echo "✅ Schedule configuration"