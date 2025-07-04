#!/usr/bin/env node

// Simple test to verify dependency resolution logic
const yaml = require('js-yaml');

// Mock issue data for testing
const mockIssues = [
  {
    number: 1,
    state: 'closed',
    body: `---
id: 1
status: completed
---

## Details
This is a completed task.
`
  },
  {
    number: 2, 
    state: 'open',
    body: `---
id: 2
dependencies: [1]
status: pending
---

## Details
This task depends on task 1.
`
  },
  {
    number: 3,
    state: 'open', 
    body: `---
id: 3
dependencies: [1, 2]
status: pending
---

## Details
This task depends on both tasks 1 and 2.
`
  },
  {
    number: 4,
    state: 'open',
    body: `---
id: 4
dependencies: [5]
status: pending
---

## Details
This task depends on task 5 which is still open.
`
  },
  {
    number: 5,
    state: 'open',
    body: `---
id: 5
status: pending
---

## Details
This task has no dependencies but is still open.
`
  }
];

// Helper to parse YAML front-matter
function parseYamlFrontMatter(body) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = body.match(frontMatterRegex);
  
  if (match) {
    try {
      const frontMatter = yaml.load(match[1]);
      return { frontMatter: frontMatter || {}, content: match[2] };
    } catch (e) {
      return { frontMatter: {}, content: body };
    }
  }
  
  return { frontMatter: {}, content: body };
}

// Helper to check if all dependencies are closed
function areAllDependenciesClosed(issue, allIssues) {
  const { frontMatter } = parseYamlFrontMatter(issue.body || '');
  
  if (!frontMatter.dependencies?.length) {
    return true; // No dependencies means not blocked
  }

  // Create a map of issue ID to issue for quick lookup
  const issueMap = new Map();
  for (const iss of allIssues) {
    if (!iss.body) continue;
    const { frontMatter: fm } = parseYamlFrontMatter(iss.body);
    if (fm.id) {
      issueMap.set(String(fm.id), iss);
    }
  }

  // Check if all dependencies are closed
  for (const depId of frontMatter.dependencies) {
    const depIssue = issueMap.get(String(depId));
    if (!depIssue || depIssue.state !== 'closed') {
      return false;
    }
  }

  return true;
}

// Helper to find dependent issues
function findDependentIssues(closedIssueId, allIssues) {
  const dependentIssues = [];

  for (const issue of allIssues) {
    if (!issue.body || issue.state !== 'open') continue;
    
    const { frontMatter } = parseYamlFrontMatter(issue.body);
    
    // Check if this issue depends on the closed issue
    if (frontMatter.dependencies?.includes(closedIssueId)) {
      dependentIssues.push(issue);
    }
  }

  return dependentIssues;
}

// Run tests
console.log('🧪 Testing dependency resolution logic...\n');

// Test 1: Check dependency resolution for each issue
console.log('✅ Test 1 - Dependency resolution status:');
for (const issue of mockIssues) {
  const { frontMatter } = parseYamlFrontMatter(issue.body);
  const allDepsClosed = areAllDependenciesClosed(issue, mockIssues);
  
  console.log(`  Issue #${issue.number} (ID: ${frontMatter.id}):
    Dependencies: ${frontMatter.dependencies || 'none'}
    All deps closed: ${allDepsClosed}
    Should be blocked: ${!allDepsClosed && frontMatter.dependencies?.length > 0}`);
}

// Test 2: Simulate closing issue 5 and check which issues become unblocked
console.log('\n✅ Test 2 - Simulate closing issue 5:');
const updatedIssues = mockIssues.map(issue => 
  issue.number === 5 ? { ...issue, state: 'closed' } : issue
);

console.log('  Issues that would become unblocked:');
const dependentsOfIssue5 = findDependentIssues(5, updatedIssues);
for (const depIssue of dependentsOfIssue5) {
  const { frontMatter } = parseYamlFrontMatter(depIssue.body);
  const allDepsClosed = areAllDependenciesClosed(depIssue, updatedIssues);
  console.log(`    Issue #${depIssue.number} (ID: ${frontMatter.id}) - Would be unblocked: ${allDepsClosed}`);
}

// Test 3: Check complex dependency chain
console.log('\n✅ Test 3 - Complex dependency chain analysis:');
console.log('  Current blocking relationships:');
for (const issue of mockIssues) {
  if (issue.state === 'open') {
    const { frontMatter } = parseYamlFrontMatter(issue.body);
    const dependents = findDependentIssues(frontMatter.id, mockIssues);
    if (dependents.length > 0) {
      console.log(`    Issue ${frontMatter.id} is blocking: ${dependents.map(d => {
        const { frontMatter: dfm } = parseYamlFrontMatter(d.body);
        return dfm.id;
      }).join(', ')}`);
    }
  }
}

console.log('\n🎉 All dependency resolution tests completed!');