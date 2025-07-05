#!/bin/bash

# Test webhook trigger configuration for dedicated workflows
echo "🧪 Testing Webhook Trigger Configuration for Dedicated Workflows"

# Test YAML syntax for the new workflows
echo "📝 Testing YAML syntax for new workflows..."

# Test taskmaster-breakdown.yml
if npx js-yaml .github/workflows/taskmaster-breakdown.yml > /dev/null 2>&1; then
    echo "✅ taskmaster-breakdown.yml YAML is valid"
else
    echo "❌ taskmaster-breakdown.yml YAML is invalid"
    exit 1
fi

# Test taskmaster-watcher.yml
if npx js-yaml .github/workflows/taskmaster-watcher.yml > /dev/null 2>&1; then
    echo "✅ taskmaster-watcher.yml YAML is valid"
else
    echo "❌ taskmaster-watcher.yml YAML is invalid"
    exit 1
fi

# Test webhook trigger configurations
echo "🔍 Testing webhook trigger configurations..."

# Test breakdown workflow has issue_comment trigger
if grep -q "issue_comment:" .github/workflows/taskmaster-breakdown.yml; then
    echo "✅ taskmaster-breakdown.yml has issue_comment trigger"
else
    echo "❌ taskmaster-breakdown.yml missing issue_comment trigger"
    exit 1
fi

# Test watcher workflow has issues trigger
if grep -q "issues:" .github/workflows/taskmaster-watcher.yml; then
    echo "✅ taskmaster-watcher.yml has issues trigger"
else
    echo "❌ taskmaster-watcher.yml missing issues trigger"
    exit 1
fi

# Test watcher workflow has schedule trigger
if grep -q "schedule:" .github/workflows/taskmaster-watcher.yml; then
    echo "✅ taskmaster-watcher.yml has schedule trigger"
else
    echo "❌ taskmaster-watcher.yml missing schedule trigger"
    exit 1
fi

# Test event filtering
echo "🔧 Testing event filtering..."

# Test breakdown command filtering
if grep -q "/breakdown" .github/workflows/taskmaster-breakdown.yml; then
    echo "✅ taskmaster-breakdown.yml has /breakdown command filtering"
else
    echo "❌ taskmaster-breakdown.yml missing /breakdown command filtering"
    exit 1
fi

# Test permissions
echo "🔐 Testing permissions configuration..."

# Test breakdown workflow permissions
if grep -A 5 "permissions:" .github/workflows/taskmaster-breakdown.yml | grep -q "issues: write"; then
    echo "✅ taskmaster-breakdown.yml has issues write permission"
else
    echo "❌ taskmaster-breakdown.yml missing issues write permission"
    exit 1
fi

# Test watcher workflow permissions
if grep -A 5 "permissions:" .github/workflows/taskmaster-watcher.yml | grep -q "issues: write"; then
    echo "✅ taskmaster-watcher.yml has issues write permission"
else
    echo "❌ taskmaster-watcher.yml missing issues write permission"
    exit 1
fi

# Test payload handling
echo "🎯 Testing payload handling..."

# Test breakdown workflow uses github.event context
if grep -q "github.event.comment" .github/workflows/taskmaster-breakdown.yml; then
    echo "✅ taskmaster-breakdown.yml handles comment payload"
else
    echo "❌ taskmaster-breakdown.yml missing comment payload handling"
    exit 1
fi

# Test watcher workflow uses github.event context
if grep -q "github.event.issue" .github/workflows/taskmaster-watcher.yml; then
    echo "✅ taskmaster-watcher.yml handles issue payload"
else
    echo "❌ taskmaster-watcher.yml missing issue payload handling"
    exit 1
fi

echo ""
echo "🎉 All webhook trigger configuration tests passed!"

echo ""
echo "Summary:"
echo "✅ YAML syntax validation for new workflows"
echo "✅ Webhook trigger configuration"
echo "✅ Event filtering implementation" 
echo "✅ Permissions properly set"
echo "✅ Payload handling implemented"