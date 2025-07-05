/**
 * Issue Parser Demo
 * 
 * This demo shows how to use the YAML front-matter parser to extract
 * structured data from GitHub issue descriptions.
 */

import { 
  parseIssueBody,
  parseYamlFrontMatter,
  parseMetadata,
  parseDependencies,
  parseRequiredBy,
  extractTaskId,
  extractParentId,
  hasYamlFrontMatter,
  type ParsedIssueData
} from '../scripts/issue-parser';

/**
 * Demo: Parse a complete issue body
 */
function demoCompleteIssueParsing(): void {
  console.log('🔍 Demo: Complete Issue Parsing');
  console.log('=' .repeat(50));

  const sampleIssueBody = `---
id: 42
parent: 100
dependencies: [10, 20, 30]
priority: high
---

## Description

Implement user authentication system with OAuth2 support.

## Details

This task involves setting up OAuth2 authentication flow with support for Google, GitHub, and Microsoft providers. The implementation should include:

- OAuth2 client configuration
- User session management
- Token refresh logic
- Error handling for failed authentication

## Test Strategy

1. Unit tests for authentication functions
2. Integration tests with mock OAuth providers
3. End-to-end tests with real OAuth flows

## Dependencies

- [x] #10 Database schema setup
- [ ] #20 API endpoint framework
- [ ] #30 Frontend routing system

## Meta

- **Status**: \`in-progress\`
- **Priority**: \`high\`
- **Complexity**: \`medium\`
- **Assignee**: \`john.doe\`

## Required By

- [ ] #150 User profile management
- [ ] #160 Administrative dashboard

<!-- created-by-taskmaster-script -->`;

  const parsed: ParsedIssueData = parseIssueBody(sampleIssueBody);
  
  console.log('📊 Parsed Data:');
  console.log('  YAML Front-matter:', JSON.stringify(parsed.yamlFrontMatter, null, 4));
  console.log('  Metadata:', JSON.stringify(parsed.metadata, null, 4));
  console.log('  Dependencies:', JSON.stringify(parsed.dependencies, null, 4));
  console.log('  Required By:', JSON.stringify(parsed.requiredBy, null, 4));
  console.log('  Description:', parsed.description);
  console.log('  Details:', parsed.details);
  console.log('  Test Strategy:', parsed.testStrategy);
  
  console.log('\n✅ Complete parsing demo completed\n');
}

/**
 * Demo: Check dependency status
 */
function demoDependencyTracking(): void {
  console.log('🔗 Demo: Dependency Status Tracking');
  console.log('=' .repeat(50));

  const issueWithDeps = `## Dependencies

- [x] #123 Backend API implementation
- [x] #124 Database migration
- [ ] #125 Frontend components
- [ ] #126 Testing framework setup

## Meta

- **Status**: \`blocked\``;

  const dependencies = parseDependencies(issueWithDeps);
  const metadata = parseMetadata(issueWithDeps);
  
  const completedDeps = dependencies.filter(dep => dep.completed);
  const pendingDeps = dependencies.filter(dep => !dep.completed);
  
  console.log('📈 Dependency Status:');
  console.log(`  Total Dependencies: ${dependencies.length}`);
  console.log(`  Completed: ${completedDeps.length}`);
  console.log(`  Pending: ${pendingDeps.length}`);
  console.log(`  Progress: ${Math.round((completedDeps.length / dependencies.length) * 100)}%`);
  
  console.log('\n🔒 Blocked Dependencies:');
  pendingDeps.forEach(dep => {
    console.log(`  - Issue #${dep.issueNumber}: ${dep.title || 'No title'}`);
  });
  
  console.log(`\n📊 Current Status: ${metadata.status || 'Unknown'}`);
  console.log('\n✅ Dependency tracking demo completed\n');
}

/**
 * Demo: Extract task hierarchy information
 */
function demoTaskHierarchy(): void {
  console.log('🌳 Demo: Task Hierarchy Extraction');
  console.log('=' .repeat(50));

  const mainTaskIssue = {
    title: '[5] Implement user authentication',
    body: `---
id: 5
dependencies: [3, 4]
---

## Description

Main authentication task

## Meta

- **Status**: \`active\``
  };

  const subtaskIssue = {
    title: '[5.2] OAuth provider integration',
    body: `---
id: 2
parent: 15
---

## Description

Integrate OAuth providers

## Meta

- **Status**: \`pending\``
  };

  console.log('🔍 Analyzing Task Hierarchy:');
  
  // Main task
  const mainTaskId = extractTaskId(mainTaskIssue.body, mainTaskIssue.title);
  const mainParentId = extractParentId(mainTaskIssue.body, mainTaskIssue.title);
  
  console.log(`  Main Task ID: ${mainTaskId}`);
  console.log(`  Main Task Parent: ${mainParentId || 'None (root task)'}`);
  
  // Subtask
  const subtaskId = extractTaskId(subtaskIssue.body, subtaskIssue.title);
  const subtaskParentId = extractParentId(subtaskIssue.body, subtaskIssue.title);
  
  console.log(`  Subtask ID: ${subtaskId}`);
  console.log(`  Subtask Parent: ${subtaskParentId}`);
  
  console.log('\n🔗 Hierarchy Relationships:');
  if (subtaskParentId) {
    console.log(`  Task #${subtaskId} is a child of Task #${subtaskParentId}`);
  }
  
  console.log('\n✅ Task hierarchy demo completed\n');
}

/**
 * Demo: Validate and analyze issue structure
 */
function demoIssueValidation(): void {
  console.log('✅ Demo: Issue Structure Validation');
  console.log('=' .repeat(50));

  const issues = [
    {
      title: 'Issue with complete YAML',
      body: `---
id: 100
dependencies: [90, 95]
---

## Description
Complete issue structure`
    },
    {
      title: 'Issue without YAML',
      body: `## Description
No YAML front-matter here

## Meta
- **Status**: \`active\``
    },
    {
      title: 'Malformed issue',
      body: `---
id: broken
dependencies: not-an-array
---

## Description
This has malformed YAML`
    }
  ];

  issues.forEach((issue, index) => {
    console.log(`\n📝 Issue ${index + 1}: ${issue.title}`);
    
    const hasYaml = hasYamlFrontMatter(issue.body);
    console.log(`  Has YAML Front-matter: ${hasYaml ? '✅' : '❌'}`);
    
    if (hasYaml) {
      const yamlData = parseYamlFrontMatter(issue.body);
      console.log(`  Task ID: ${yamlData.id || 'Not found'}`);
      console.log(`  Dependencies: ${Array.isArray(yamlData.dependencies) ? yamlData.dependencies.length : 'None'}`);
    }
    
    const metadata = parseMetadata(issue.body);
    const hasMetadata = Object.keys(metadata).length > 0;
    console.log(`  Has Metadata: ${hasMetadata ? '✅' : '❌'}`);
    
    if (hasMetadata) {
      console.log(`  Status: ${metadata.status || 'Not specified'}`);
    }
  });
  
  console.log('\n✅ Issue validation demo completed\n');
}

/**
 * Demo: Round-trip parsing (generate → parse → validate)
 */
function demoRoundTripParsing(): void {
  console.log('🔄 Demo: Round-trip Parsing');
  console.log('=' .repeat(50));

  // Simulate the buildIssueBody function from the main action
  function buildIssueBody(task: any, parentIssue?: any): string {
    const yamlLines = [
      '---',
      `id: ${task.id}`,
      parentIssue ? `parent: ${parentIssue.number}` : '',
      task.dependencies && task.dependencies.length > 0 ? 
        `dependencies: [${task.dependencies.join(', ')}]` : '',
      '---'
    ].filter(line => line !== '');
    
    const yamlFrontMatter = yamlLines.join('\n') + '\n\n';

    let body = yamlFrontMatter;

    if (task.description) {
      body += `## Description\n\n${task.description}\n\n`;
    }

    if (task.details) {
      body += `## Details\n\n${task.details}\n\n`;
    }

    if (task.dependencies && task.dependencies.length > 0) {
      body += `## Dependencies\n\n${task.dependencies.map((dep: number) => `- [ ] Task #${dep}`).join('\n')}\n\n`;
    }

    const meta = [];
    if (task.status) meta.push(`- **Status**: \`${task.status}\``);
    if (task.priority) meta.push(`- **Priority**: \`${task.priority}\``);

    if (meta.length > 0) {
      body += `## Meta\n\n${meta.join('\n')}\n\n`;
    }

    body += '<!-- created-by-taskmaster-script -->';
    return body;
  }

  // Create test task
  const originalTask = {
    id: 999,
    title: "Round-trip Test Task",
    description: "Testing round-trip parsing functionality",
    details: "Ensure that generate → parse → validate workflow works correctly",
    priority: "medium",
    status: "testing",
    dependencies: [100, 200, 300]
  };

  console.log('📝 Original Task Data:');
  console.log(JSON.stringify(originalTask, null, 2));

  // Generate issue body
  const generatedBody = buildIssueBody(originalTask);
  console.log('\n🔨 Generated Issue Body:');
  console.log(generatedBody);

  // Parse the generated body
  const parsedData = parseIssueBody(generatedBody);
  console.log('\n🔍 Parsed Data:');
  console.log('  YAML:', JSON.stringify(parsedData.yamlFrontMatter, null, 2));
  console.log('  Metadata:', JSON.stringify(parsedData.metadata, null, 2));
  console.log('  Dependencies:', JSON.stringify(parsedData.dependencies, null, 2));

  // Validate round-trip
  const yamlMatches = parsedData.yamlFrontMatter.id === originalTask.id &&
    Array.isArray(parsedData.yamlFrontMatter.dependencies) &&
    parsedData.yamlFrontMatter.dependencies.length === originalTask.dependencies.length;
    
  const metadataMatches = parsedData.metadata.status === originalTask.status &&
    parsedData.metadata.priority === originalTask.priority;

  console.log('\n✅ Round-trip Validation:');
  console.log(`  YAML Front-matter: ${yamlMatches ? '✅ Matches' : '❌ Mismatch'}`);
  console.log(`  Metadata: ${metadataMatches ? '✅ Matches' : '❌ Mismatch'}`);
  console.log(`  Overall: ${yamlMatches && metadataMatches ? '✅ Success' : '❌ Failed'}`);
  
  console.log('\n✅ Round-trip parsing demo completed\n');
}

/**
 * Main demo function
 */
function runDemos(): void {
  console.log('🚀 Issue Parser Demo');
  console.log('This demo showcases the YAML front-matter parser functionality\n');

  demoCompleteIssueParsing();
  demoDependencyTracking();
  demoTaskHierarchy();
  demoIssueValidation();
  demoRoundTripParsing();

  console.log('🎉 All demos completed successfully!');
  console.log('\nThe parser can now be used to:');
  console.log('  • Extract structured data from GitHub issue descriptions');
  console.log('  • Parse YAML front-matter with id, parent, dependencies');
  console.log('  • Extract metadata like status, priority, complexity');
  console.log('  • Track dependency completion status');
  console.log('  • Analyze task hierarchy relationships');
  console.log('  • Validate issue structure');
  console.log('  • Support round-trip parsing workflows');
}

// Run the demos
if (require.main === module) {
  runDemos();
}

export { runDemos };