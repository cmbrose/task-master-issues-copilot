#!/usr/bin/env node

/**
 * Simple test script to verify JSON parsing functionality
 */

const fs = require('fs');
const path = require('path');

// Import the compiled scripts
const { parseTaskGraphJson, extractTasksForGitHub, calculateTaskComplexity } = require('./scripts/dist/output-validation');

// Create a sample task graph for testing
const sampleTaskGraph = {
  "tasks": [
    {
      "id": 1,
      "title": "Setup Repository Structure",
      "description": "Initialize the GitHub Action template repository with proper directory structure",
      "details": "Create .github/workflows/ directory structure and action.yml",
      "priority": "high",
      "dependencies": [],
      "status": "pending",
      "subtasks": [
        {
          "id": 1,
          "title": "Create directory structure",
          "description": "Set up the basic directory structure",
          "dependencies": [],
          "status": "pending"
        },
        {
          "id": 2,
          "title": "Setup action.yml metadata",
          "description": "Create and configure the action.yml file",
          "dependencies": [1],
          "status": "pending"
        }
      ]
    },
    {
      "id": 2,
      "title": "Implement Core Actions",
      "description": "Develop the main GitHub Actions functionality",
      "priority": "medium",
      "dependencies": [1],
      "status": "pending"
    }
  ],
  "metadata": {
    "version": "1.0.0",
    "generatedAt": "2024-01-01T00:00:00Z",
    "source": "test-prd.md",
    "totalTasks": 4
  }
};

console.log('🧪 Testing JSON Parsing Functionality');
console.log('=====================================');

// Test 1: Valid JSON parsing
console.log('\n1. Testing valid JSON parsing...');
const validJson = JSON.stringify(sampleTaskGraph, null, 2);
const parseResult = parseTaskGraphJson(validJson);

if (parseResult.errors.length === 0 && parseResult.data) {
  console.log('✅ Valid JSON parsed successfully');
  console.log(`   Tasks found: ${parseResult.data.tasks.length}`);
  console.log(`   Metadata: ${JSON.stringify(parseResult.data.metadata, null, 2)}`);
} else {
  console.log('❌ Valid JSON parsing failed:');
  parseResult.errors.forEach(error => console.log(`   - ${error}`));
}

// Test 2: Invalid JSON parsing
console.log('\n2. Testing invalid JSON parsing...');
const invalidJson = '{ "tasks": [{ "id": 1, "title": "test", }] }'; // trailing comma
const invalidParseResult = parseTaskGraphJson(invalidJson);

if (invalidParseResult.errors.length > 0) {
  console.log('✅ Invalid JSON properly rejected');
  console.log(`   Errors: ${invalidParseResult.errors.length}`);
  console.log(`   Parse errors: ${invalidParseResult.parseErrors.length}`);
} else {
  console.log('❌ Invalid JSON was incorrectly accepted');
}

// Test 3: Schema validation
console.log('\n3. Testing schema validation...');
const invalidSchema = { "wrongField": "test" };
const schemaResult = parseTaskGraphJson(JSON.stringify(invalidSchema));

if (schemaResult.validationErrors.length > 0) {
  console.log('✅ Schema validation working');
  console.log(`   Validation errors: ${schemaResult.validationErrors.length}`);
} else {
  console.log('❌ Schema validation failed');
}

// Test 4: GitHub API data extraction
if (parseResult.data) {
  console.log('\n4. Testing GitHub API data extraction...');
  const githubData = extractTasksForGitHub(parseResult.data);
  
  if (githubData.errors.length === 0) {
    console.log('✅ GitHub API data extraction successful');
    console.log(`   GitHub tasks created: ${githubData.tasks.length}`);
    githubData.tasks.forEach((task, i) => {
      console.log(`   Task ${i + 1}: ${task.title}`);
      console.log(`     Labels: ${task.labels.join(', ')}`);
      console.log(`     Dependencies: ${task.metadata.dependencies.join(', ') || 'none'}`);
    });
  } else {
    console.log('❌ GitHub API data extraction failed:');
    githubData.errors.forEach(error => console.log(`   - ${error}`));
  }

  // Test 5: Complexity calculation
  console.log('\n5. Testing complexity calculation...');
  const complexity = calculateTaskComplexity(parseResult.data);
  console.log('✅ Complexity calculation successful');
  console.log(`   Total tasks: ${complexity.totalTasks}`);
  console.log(`   Max depth: ${complexity.maxDepth}`);
  console.log(`   Average subtasks: ${complexity.averageSubtasks.toFixed(1)}`);
  console.log(`   Complexity score: ${complexity.complexityScore}/10`);
}

console.log('\n🎉 JSON parsing test completed!');