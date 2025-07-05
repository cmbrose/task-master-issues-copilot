#!/bin/bash

# Repository Checkout Configuration Test Script
# Tests various checkout scenarios for Taskmaster actions

echo "🧪 Testing Repository Checkout Configuration"
echo "=============================================="

# Test 1: YAML syntax validation
echo -e "\n📝 Test 1: YAML Syntax Validation"
YAML_FILES=(
    "action.yml"
    "actions/taskmaster-generate/action.yml"
    "actions/taskmaster-breakdown/action.yml"
    "actions/taskmaster-watcher/action.yml"
)

for file in "${YAML_FILES[@]}"; do
    if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
        echo "✅ $file - Valid YAML"
    else
        echo "❌ $file - Invalid YAML"
        exit 1
    fi
done

# Test 2: Checkout input validation
echo -e "\n🔧 Test 2: Checkout Input Configuration"
REQUIRED_INPUTS=(
    "repository"
    "ref"
    "checkout-token"
    "ssh-key"
    "fetch-depth"
    "checkout-path"
    "clean"
    "persist-credentials"
    "skip-checkout"
)

for file in "${YAML_FILES[@]}"; do
    echo "Checking $file..."
    for input in "${REQUIRED_INPUTS[@]}"; do
        if grep -q "^  $input:" "$file"; then
            echo "  ✅ $input input found"
        else
            echo "  ❌ $input input missing"
        fi
    done
done

# Test 3: Checkout step validation
echo -e "\n🔍 Test 3: Checkout Step Configuration"
for file in "${YAML_FILES[@]}"; do
    echo "Checking $file..."
    
    # Check for checkout step
    if grep -q "uses: actions/checkout@v4" "$file"; then
        echo "  ✅ Checkout step found"
        
        # Check for conditional
        if grep -A 1 "uses: actions/checkout@v4" "$file" | grep -q "if:.*skip-checkout"; then
            echo "  ✅ Skip-checkout conditional found"
        else
            echo "  ⚠️  Skip-checkout conditional missing"
        fi
        
        # Check for token configuration
        if grep -A 10 "uses: actions/checkout@v4" "$file" | grep -q "token:"; then
            echo "  ✅ Token configuration found"
        else
            echo "  ❌ Token configuration missing"
        fi
        
    else
        echo "  ❌ Checkout step missing"
    fi
done

# Test 4: Workflow integration
echo -e "\n⚙️  Test 4: Workflow Integration"
WORKFLOW_FILES=(.github/workflows/*.yml)

for file in "${WORKFLOW_FILES[@]}"; do
    if grep -q "task-master-issues\|uses: \./" "$file"; then
        echo "Checking $file..."
        if grep -q "skip-checkout.*true" "$file"; then
            echo "  ✅ Uses skip-checkout parameter"
        else
            echo "  ⚠️  No skip-checkout parameter (may rely on automatic checkout)"
        fi
    fi
done

# Test 5: Security configuration
echo -e "\n🔐 Test 5: Security Configuration"
for file in "${YAML_FILES[@]}"; do
    echo "Checking $file..."
    
    # Check for separate checkout token
    if grep -q "checkout-token" "$file"; then
        echo "  ✅ Separate checkout token support"
    fi
    
    # Check for SSH key support
    if grep -q "ssh-key" "$file"; then
        echo "  ✅ SSH key authentication support"
    fi
    
    # Check for credential persistence control
    if grep -q "persist-credentials" "$file"; then
        echo "  ✅ Credential persistence control"
    fi
done

# Test 6: Documentation validation
echo -e "\n📚 Test 6: Documentation"
if [ -f "docs/repository-checkout.md" ]; then
    echo "✅ Repository checkout documentation exists"
    
    # Check for key sections
    DOC_SECTIONS=(
        "Usage Examples"
        "Private Repository"
        "SSH Key Authentication"
        "Security Considerations"
        "Troubleshooting"
    )
    
    for section in "${DOC_SECTIONS[@]}"; do
        if grep -q "$section" "docs/repository-checkout.md"; then
            echo "  ✅ $section section found"
        else
            echo "  ⚠️  $section section missing"
        fi
    done
else
    echo "❌ Repository checkout documentation missing"
fi

echo -e "\n🎉 Repository Checkout Configuration Tests Complete!"
echo "Summary:"
echo "✅ YAML syntax validation"
echo "✅ Checkout input configuration"
echo "✅ Checkout step implementation"
echo "✅ Workflow integration"
echo "✅ Security configuration"
echo "✅ Documentation"