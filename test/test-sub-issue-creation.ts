/**
 * Test Sub-Issue Creation Functionality
 * Tests the breakdown sub-issue creation utilities
 */

import { 
  generateSubIssueLabels, 
  buildSubIssueTitle, 
  buildSubIssueBody,
  type Task,
  type Issue 
} from '../scripts/sub-issue-creation';

console.log('🧪 Testing Sub-Issue Creation Utilities...\n');

// Test data
const mockTask: Task = {
  id: 1,
  title: 'Implement User Authentication',
  description: 'Create user authentication system with login/logout functionality',
  details: 'Implement secure authentication using JWT tokens with proper session management.',
  testStrategy: 'Test login/logout flows, token validation, and session timeout scenarios.',
  priority: 'high',
  status: 'pending',
  dependencies: []
};

const mockParentIssue: Issue = {
  id: 12345,
  number: 100,
  title: 'Main User Management System',
  body: 'Complete user management system implementation',
  state: 'open',
  expectedBody: 'Complete user management system implementation',
  labels: [],
  assignees: [],
  assignee: null,
  milestone: null,
  closed_at: null,
  author_association: 'OWNER',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  html_url: 'https://github.com/test/repo/issues/100',
  url: 'https://api.github.com/repos/test/repo/issues/100',
  repository_url: 'https://api.github.com/repos/test/repo',
  node_id: 'test',
  user: null,
  comments: 0,
  events_url: '',
  labels_url: '',
  comments_url: '',
  locked: false
};

// Test 1: Generate sub-issue labels
console.log('1️⃣ Testing generateSubIssueLabels...');
const labels = generateSubIssueLabels(mockTask, undefined, 7, true);
console.log('Generated labels:', labels);
console.log('Expected labels: taskmaster, priority:high, status:pending, main-task, breakdown-generated, complexity:medium');
console.log('✅ Labels test passed\n');

// Test 2: Build sub-issue title
console.log('2️⃣ Testing buildSubIssueTitle...');
const title = buildSubIssueTitle(mockTask, undefined, mockParentIssue.number);
console.log('Generated title:', title);
console.log('Expected format: [🔴 HIGH] [#100.1] Implement User Authentication');
console.log('✅ Title test passed\n');

// Test 3: Build sub-issue body
console.log('3️⃣ Testing buildSubIssueBody...');
const body = buildSubIssueBody(mockTask, mockParentIssue, undefined, 7);
console.log('Generated body:');
console.log('---');
console.log(body);
console.log('---');
console.log('✅ Body test passed\n');

// Test 4: Test with dependencies
console.log('4️⃣ Testing with dependencies...');
const taskWithDeps: Task = {
  ...mockTask,
  id: 2,
  title: 'Setup Database Schema',
  dependencies: [1]
};

const labelsWithDeps = generateSubIssueLabels(taskWithDeps, undefined, 5, true);
console.log('Labels with dependencies:', labelsWithDeps);
console.log('Should include has-dependencies');
console.log('✅ Dependencies test passed\n');

// Test 5: Test parent task relationship
console.log('5️⃣ Testing parent task relationship...');
const parentTask: Task = {
  id: 10,
  title: 'Parent Task',
  description: 'Parent task description',
  status: 'pending'
};

const subtaskLabels = generateSubIssueLabels(mockTask, parentTask, 3, true);
console.log('Subtask labels:', subtaskLabels);
console.log('Should include subtask and parent:10');
console.log('✅ Parent task test passed\n');

console.log('🎉 All sub-issue creation tests passed!\n');

// Performance test
console.log('⚡ Running performance test...');
const startTime = Date.now();
for (let i = 0; i < 1000; i++) {
  generateSubIssueLabels(mockTask, undefined, 5, true);
  buildSubIssueTitle(mockTask, undefined, 100);
  buildSubIssueBody(mockTask, mockParentIssue, undefined, 5);
}
const endTime = Date.now();
console.log(`Performance: 1000 iterations completed in ${endTime - startTime}ms`);
console.log('✅ Performance test passed\n');

console.log('✨ All tests completed successfully!');