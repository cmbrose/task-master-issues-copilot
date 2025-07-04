#!/usr/bin/env node

// Simple test to verify YAML front-matter parsing functionality
const yaml = require('js-yaml');

// Test YAML front-matter parsing
function parseYamlFrontMatter(body) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = body.match(frontMatterRegex);
  
  if (match) {
    try {
      const frontMatter = yaml.load(match[1]);
      return { frontMatter, content: match[2] };
    } catch (e) {
      console.warn('Failed to parse YAML front-matter:', e);
      return { frontMatter: {}, content: body };
    }
  }
  
  return { frontMatter: {}, content: body };
}

// Test YAML front-matter creation
function createYamlFrontMatter(task, parentTask) {
  const frontMatter = {};
  
  // Add task ID
  if (parentTask) {
    frontMatter.id = `${parentTask.id}.${task.id}`;
    frontMatter.parent = parentTask.id;
  } else {
    frontMatter.id = task.id;
  }
  
  // Add dependencies
  if (task.dependencies?.length) {
    frontMatter.dependencies = task.dependencies;
  }
  
  // Add required by relationships
  if (task.requiredBy?.length) {
    frontMatter.dependents = task.requiredBy.map(t => t.id);
  }
  
  // Add status and priority
  if (task.status) {
    frontMatter.status = task.status;
  }
  if (task.priority) {
    frontMatter.priority = task.priority;
  }
  
  return frontMatter;
}

// Test cases
console.log('🧪 Testing YAML front-matter functionality...\n');

// Test 1: Parse existing YAML front-matter
const testBody1 = `---
id: 4
dependencies: [3]
status: pending
priority: high
---

## Details
This is a test issue with YAML front-matter.

## Dependencies
- [ ] #225
`;

const result1 = parseYamlFrontMatter(testBody1);
console.log('✅ Test 1 - Parse YAML front-matter:');
console.log('  Front-matter:', JSON.stringify(result1.frontMatter, null, 2));
console.log('  Content preview:', result1.content.substring(0, 50) + '...\n');

// Test 2: Create YAML front-matter
const testTask = {
  id: 4,
  title: 'Test Task',
  dependencies: [3],
  status: 'pending',
  priority: 'high',
  requiredBy: [{ id: 5 }, { id: 6 }]
};

const result2 = createYamlFrontMatter(testTask);
console.log('✅ Test 2 - Create YAML front-matter:');
console.log('  Generated:', JSON.stringify(result2, null, 2));

const yamlString = '---\n' + yaml.dump(result2) + '---\n\n';
console.log('  YAML string:');
console.log(yamlString);

// Test 3: Round-trip test
const result3 = parseYamlFrontMatter(yamlString + 'Content here');
console.log('✅ Test 3 - Round-trip test:');
console.log('  Parsed back:', JSON.stringify(result3.frontMatter, null, 2));
console.log('  Same as original?', JSON.stringify(result2) === JSON.stringify(result3.frontMatter));

console.log('\n🎉 All tests completed!');