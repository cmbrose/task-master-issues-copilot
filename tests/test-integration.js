#!/usr/bin/env node

// Integration test for issue hierarchy and dependency management
const yaml = require('js-yaml');

console.log('🧪 Testing Issue Hierarchy and Dependency Management...\n');

// Test scenario: Complex dependency chain
const testTasks = [
  {
    id: 1,
    title: 'Setup Foundation',
    description: 'Basic setup task',
    dependencies: [],
    status: 'completed'
  },
  {
    id: 2, 
    title: 'Build Core Features',
    description: 'Core functionality',
    dependencies: [1],
    status: 'in-progress'
  },
  {
    id: 3,
    title: 'Add UI Components', 
    description: 'User interface components',
    dependencies: [2],
    status: 'pending'
  },
  {
    id: 4,
    title: 'Testing Framework',
    description: 'Testing infrastructure',
    dependencies: [1],
    status: 'pending'
  },
  {
    id: 5,
    title: 'Integration Tests',
    description: 'End-to-end testing',
    dependencies: [3, 4],
    status: 'pending'
  },
  {
    id: 6,
    title: 'Documentation',
    description: 'Project documentation',
    dependencies: [5],
    status: 'pending'
  }
];

// Simulate issue states
const mockIssues = testTasks.map((task, index) => {
  const state = task.status === 'completed' ? 'closed' : 'open';
  
  // Create YAML front-matter
  const frontMatter = {
    id: task.id,
    dependencies: task.dependencies.length > 0 ? task.dependencies : undefined,
    status: task.status
  };

  const yamlString = Object.keys(frontMatter).filter(k => frontMatter[k] !== undefined).length > 0 
    ? '---\n' + yaml.dump(frontMatter) + '---\n\n' 
    : '';

  // Determine if should be blocked based on dependencies
  let shouldBeBlocked = false;
  if (state === 'open' && task.dependencies.length > 0) {
    // Check if any dependency is not completed
    shouldBeBlocked = task.dependencies.some(depId => {
      const depTask = testTasks.find(t => t.id === depId);
      return !depTask || depTask.status !== 'completed';
    });
  }

  const labels = ['taskmaster'];
  if (shouldBeBlocked) {
    labels.push('blocked');
  }

  return {
    number: index + 100, // Simulate GitHub issue numbers
    state,
    title: task.title,
    body: yamlString + `## Details\n${task.description}\n\n## Dependencies\n\n`,
    labels
  };
});

console.log('📋 Initial Test Scenario:');
mockIssues.forEach(issue => {
  const { frontMatter } = parseYamlFrontMatter(issue.body);
  const hasBlocked = issue.labels.includes('blocked');
  console.log(`  Issue #${issue.number}: ${issue.title}
    State: ${issue.state}
    Dependencies: ${frontMatter.dependencies || 'none'}
    Blocked: ${hasBlocked}`);
});

// Helper functions (same as in watcher)
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

function areAllDependenciesClosed(issue, allIssues) {
  const { frontMatter } = parseYamlFrontMatter(issue.body || '');
  
  if (!frontMatter.dependencies?.length) {
    return true;
  }

  const issueMap = new Map();
  for (const iss of allIssues) {
    if (!iss.body) continue;
    const { frontMatter: fm } = parseYamlFrontMatter(iss.body);
    if (fm.id) {
      issueMap.set(String(fm.id), iss);
    }
  }

  for (const depId of frontMatter.dependencies) {
    const depIssue = issueMap.get(String(depId));
    if (!depIssue || depIssue.state !== 'closed') {
      return false;
    }
  }

  return true;
}

function findDependentIssues(closedIssueId, allIssues) {
  const dependentIssues = [];

  for (const issue of allIssues) {
    if (!issue.body || issue.state !== 'open') continue;
    
    const { frontMatter } = parseYamlFrontMatter(issue.body);
    
    if (frontMatter.dependencies?.includes(closedIssueId)) {
      dependentIssues.push(issue);
    }
  }

  return dependentIssues;
}

// Test 1: Check initial blocked status
console.log('\n✅ Test 1 - Initial blocked status validation:');
mockIssues.forEach(issue => {
  if (issue.state === 'open') {
    const shouldBeBlocked = !areAllDependenciesClosed(issue, mockIssues);
    const isBlocked = issue.labels.includes('blocked');
    const correct = shouldBeBlocked === isBlocked;
    
    console.log(`  Issue #${issue.number}: Should be blocked: ${shouldBeBlocked}, Is blocked: ${isBlocked} ${correct ? '✓' : '✗'}`);
  }
});

// Test 2: Simulate completing task 2 (Build Core Features)
console.log('\n✅ Test 2 - Simulate completing task 2:');
const updatedIssues1 = mockIssues.map(issue => {
  const { frontMatter } = parseYamlFrontMatter(issue.body);
  return frontMatter.id === 2 ? { ...issue, state: 'closed' } : issue;
});

const dependentsOfTask2 = findDependentIssues(2, updatedIssues1);
console.log(`  Task 2 completion would unblock ${dependentsOfTask2.length} issues:`);
dependentsOfTask2.forEach(issue => {
  const { frontMatter } = parseYamlFrontMatter(issue.body);
  const wouldBeUnblocked = areAllDependenciesClosed(issue, updatedIssues1);
  console.log(`    Issue #${issue.number} (Task ${frontMatter.id}): Would be unblocked: ${wouldBeUnblocked}`);
});

// Test 3: Simulate completing multiple tasks in sequence
console.log('\n✅ Test 3 - Sequential task completion simulation:');
let currentIssues = [...mockIssues];
const completionOrder = [2, 4, 3]; // Complete Build Core, then Testing Framework, then UI Components

completionOrder.forEach(taskId => {
  console.log(`  Completing task ${taskId}:`);
  
  // Mark task as closed
  currentIssues = currentIssues.map(issue => {
    const { frontMatter } = parseYamlFrontMatter(issue.body);
    return frontMatter.id === taskId ? { ...issue, state: 'closed' } : issue;
  });
  
  // Check which tasks become unblocked
  const dependents = findDependentIssues(taskId, currentIssues);
  dependents.forEach(issue => {
    const { frontMatter } = parseYamlFrontMatter(issue.body);
    const isUnblocked = areAllDependenciesClosed(issue, currentIssues);
    if (isUnblocked) {
      console.log(`    → Task ${frontMatter.id} (${issue.title}) is now unblocked`);
    }
  });
});

// Test 4: Validate final state
console.log('\n✅ Test 4 - Final dependency state:');
const finalBlockedCount = currentIssues.filter(issue => {
  if (issue.state !== 'open') return false;
  return !areAllDependenciesClosed(issue, currentIssues);
}).length;

console.log(`  Remaining blocked issues: ${finalBlockedCount}`);
console.log(`  All dependency chains resolved correctly: ${finalBlockedCount === 1 ? '✓' : '✗'}`);
console.log(`  (Only task 6 should remain blocked, waiting for task 5)`);

// Test 5: Error handling test
console.log('\n✅ Test 5 - Error handling for malformed YAML:');
const malformedIssue = {
  number: 999,
  state: 'open',
  body: `---
id: 999
dependencies: [1
malformed yaml here
---

## Details
This should gracefully handle malformed YAML.`
};

const { frontMatter: errorFM } = parseYamlFrontMatter(malformedIssue.body);
console.log(`  Malformed YAML handled gracefully: ${Object.keys(errorFM).length === 0 ? '✓' : '✗'}`);

console.log('\n🎉 All integration tests completed!');