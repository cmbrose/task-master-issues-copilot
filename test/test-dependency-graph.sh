#!/bin/bash

# Test Dependency Graph functionality
# This script validates the dependency graph data structure and algorithms

echo "🧪 Testing Dependency Graph Functionality"
echo "==========================================="

# Check if dependencies are installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js and npm."
    exit 1
fi

# Run TypeScript dependency graph tests
echo "📋 Running dependency graph tests..."
cd "$(dirname "$0")/.."
npx ts-node test/test-dependency-graph.ts

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 All dependency graph tests passed!"
    echo ""
    echo "✅ Graph data structure working correctly"
    echo "✅ Cycle detection implemented"
    echo "✅ Dependency resolution ordering functional"
    echo "✅ Ready node detection working"
    echo "✅ Transitive dependency calculations correct"
    echo "✅ Integration with task structures validated"
    exit 0
else
    echo ""
    echo "❌ Some dependency graph tests failed!"
    echo "Please review the implementation and fix any issues."
    exit 1
fi