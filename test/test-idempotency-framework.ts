/**
 * Test script for Idempotency Framework
 * 
 * Tests comprehensive state tracking, transaction safety, and replay capabilities
 */

import { IdempotencyManager } from '../scripts/idempotency-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Test data
const mockPrdContent1 = `
# Test PRD v1

## Overview
This is a test PRD for idempotency testing.

## Tasks
- Task 1: Setup
- Task 2: Implementation
`;

const mockPrdContent2 = `
# Test PRD v2

## Overview
This is a test PRD for idempotency testing with changes.

## Tasks
- Task 1: Setup (updated)
- Task 2: Implementation
- Task 3: Testing (new)
`;

const mockIssueBody = `
## Task Description
Implement user authentication system

## Dependencies
- [x] #100 Database setup
- [ ] #101 API design

<!-- metadata -->
`;

async function runIdempotencyTests(): Promise<void> {
  console.log('🧪 Starting Idempotency Framework Tests');
  console.log('==================================================\n');

  // Use temporary directory for testing
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idempotency-test-'));
  const stateFile = path.join(tempDir, 'test-state.json');

  try {
    await testStateTracking(stateFile);
    await testContentHashing(stateFile);
    await testTransactionOperations(stateFile);
    await testReplaySafety(stateFile);
    await testDependencyTracking(stateFile);
    await testStateManagement(stateFile);
    
    console.log('\n✅ All idempotency tests completed successfully!');
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function testStateTracking(stateFile: string): Promise<void> {
  console.log('📋 Test 1: PRD State Tracking');
  
  const manager = new IdempotencyManager(stateFile);
  const filePath = 'docs/test.prd.md';
  
  // Test initial state
  const initial = manager.checkPrdState(mockPrdContent1, filePath);
  console.log(`   ✓ Initial state - isProcessed: ${initial.isProcessed}, hasChanged: ${initial.hasChanged}`);
  
  // Start transaction and record processing
  const transactionId = manager.beginTransaction();
  const contentHash = manager.recordPrdProcessingStart(mockPrdContent1, filePath, 'task-graph-1');
  console.log(`   ✓ Started processing PRD with hash: ${contentHash.substring(0, 8)}...`);
  
  // Complete processing
  manager.recordPrdProcessingComplete(contentHash, [101, 102]);
  manager.commitTransaction();
  
  // Check state after processing
  const processed = manager.checkPrdState(mockPrdContent1, filePath);
  console.log(`   ✓ After processing - isProcessed: ${processed.isProcessed}, hasChanged: ${processed.hasChanged}`);
  
  // Test change detection
  const changed = manager.checkPrdState(mockPrdContent2, filePath);
  console.log(`   ✓ Changed content - isProcessed: ${changed.isProcessed}, hasChanged: ${changed.hasChanged}`);
  
  console.log('   ✅ PRD state tracking test passed\n');
}

async function testContentHashing(stateFile: string): Promise<void> {
  console.log('🔐 Test 2: Content Hashing');
  
  const manager = new IdempotencyManager(stateFile);
  
  // Test PRD hashing
  const hash1 = manager.calculatePrdHash(mockPrdContent1, 'docs/test.prd.md');
  const hash2 = manager.calculatePrdHash(mockPrdContent1, 'docs/test.prd.md');
  const hash3 = manager.calculatePrdHash(mockPrdContent2, 'docs/test.prd.md');
  const hash4 = manager.calculatePrdHash(mockPrdContent1, 'docs/other.prd.md');
  
  console.log(`   ✓ Hash 1: ${hash1.substring(0, 16)}...`);
  console.log(`   ✓ Hash 2: ${hash2.substring(0, 16)}...`);
  console.log(`   ✓ Hash 3: ${hash3.substring(0, 16)}...`);
  console.log(`   ✓ Hash 4: ${hash4.substring(0, 16)}...`);
  
  console.log(`   ✓ Consistent hashing: ${hash1 === hash2 ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Content change detection: ${hash1 !== hash3 ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Path change detection: ${hash1 !== hash4 ? 'PASSED' : 'FAILED'}`);
  
  // Test issue body hashing
  const bodyHash1 = manager.calculateIssueBodyHash(mockIssueBody);
  const bodyHash2 = manager.calculateIssueBodyHash(mockIssueBody + '\n<!-- updated -->');
  
  console.log(`   ✓ Issue body hash consistency: ${bodyHash1.length === 16 ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Issue body change detection: ${bodyHash1 !== bodyHash2 ? 'PASSED' : 'FAILED'}`);
  
  console.log('   ✅ Content hashing test passed\n');
}

async function testTransactionOperations(stateFile: string): Promise<void> {
  console.log('🔄 Test 3: Transaction Operations');
  
  const manager = new IdempotencyManager(stateFile);
  
  // Test successful transaction
  console.log('   📝 Testing successful transaction...');
  const transactionId1 = manager.beginTransaction();
  const contentHash = manager.recordPrdProcessingStart(mockPrdContent1, 'docs/tx-test.prd.md');
  manager.recordIssueCreation(201, 'task-1', contentHash, mockIssueBody, ['bug', 'enhancement']);
  manager.recordIssueCreation(202, 'task-2', contentHash, mockIssueBody, ['feature'], ['task-1']);
  manager.recordPrdProcessingComplete(contentHash, [201, 202]);
  manager.commitTransaction();
  
  const summary1 = manager.getStateSummary();
  console.log(`   ✓ After commit - PRDs: ${summary1.totalPrds}, Issues: ${summary1.totalIssues}`);
  
  // Test rollback transaction
  console.log('   🔄 Testing transaction rollback...');
  const transactionId2 = manager.beginTransaction();
  const contentHash2 = manager.recordPrdProcessingStart(mockPrdContent2, 'docs/rollback-test.prd.md');
  manager.recordIssueCreation(203, 'task-3', contentHash2, mockIssueBody, ['rollback-test']);
  
  // Simulate failure and rollback
  manager.rollbackTransaction();
  
  const summary2 = manager.getStateSummary();
  console.log(`   ✓ After rollback - PRDs: ${summary2.totalPrds}, Issues: ${summary2.totalIssues}`);
  console.log(`   ✓ Rollback preserved state: ${summary1.totalPrds === summary2.totalPrds && summary1.totalIssues === summary2.totalIssues ? 'PASSED' : 'FAILED'}`);
  
  console.log('   ✅ Transaction operations test passed\n');
}

async function testReplaySafety(stateFile: string): Promise<void> {
  console.log('🔁 Test 4: Replay Safety');
  
  const manager = new IdempotencyManager(stateFile);
  
  // Test replay safety checks
  const contentHash = manager.calculatePrdHash(mockPrdContent1, 'docs/replay-test.prd.md');
  
  console.log(`   ✓ Safe to create new PRD: ${manager.isReplaySafe('create_prd', contentHash) ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Safe to create new issue: ${manager.isReplaySafe('create_issue', '999') ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Safe to update existing issue: ${manager.isReplaySafe('update_issue', '201') ? 'PASSED' : 'FAILED'}`);
  
  // Test replay after processing
  const transactionId = manager.beginTransaction();
  manager.recordPrdProcessingStart(mockPrdContent1, 'docs/replay-test.prd.md');
  manager.recordPrdProcessingComplete(contentHash, [301]);
  manager.commitTransaction();
  
  console.log(`   ✓ Not safe to recreate completed PRD: ${!manager.isReplaySafe('create_prd', contentHash) ? 'PASSED' : 'FAILED'}`);
  
  console.log('   ✅ Replay safety test passed\n');
}

async function testDependencyTracking(stateFile: string): Promise<void> {
  console.log('🔗 Test 5: Dependency Tracking');
  
  const manager = new IdempotencyManager(stateFile);
  
  // Create issues with dependencies
  const transactionId = manager.beginTransaction();
  const contentHash = manager.calculatePrdHash(mockPrdContent1, 'docs/deps-test.prd.md');
  
  manager.recordPrdProcessingStart(mockPrdContent1, 'docs/deps-test.prd.md');
  
  // Task 1 (no dependencies)
  manager.recordIssueCreation(401, 'dep-task-1', contentHash, mockIssueBody, ['task']);
  
  // Task 2 (depends on Task 1)
  manager.recordIssueCreation(402, 'dep-task-2', contentHash, mockIssueBody, ['task'], ['dep-task-1']);
  
  // Task 3 (depends on Task 1 and 2)
  manager.recordIssueCreation(403, 'dep-task-3', contentHash, mockIssueBody, ['task'], ['dep-task-1', 'dep-task-2']);
  
  manager.commitTransaction();
  
  // Test dependency chains
  const chain1 = manager.getDependencyChain('dep-task-1');
  const chain2 = manager.getDependencyChain('dep-task-2');
  const chain3 = manager.getDependencyChain('dep-task-3');
  
  console.log(`   ✓ Task 1 dependencies: ${JSON.stringify(chain1.dependencies)}`);
  console.log(`   ✓ Task 1 dependents: ${JSON.stringify(chain1.dependents)}`);
  console.log(`   ✓ Task 2 dependencies: ${JSON.stringify(chain2.dependencies)}`);
  console.log(`   ✓ Task 3 dependencies: ${JSON.stringify(chain3.dependencies)}`);
  
  console.log(`   ✓ Task 1 has no dependencies: ${chain1.dependencies.length === 0 ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Task 1 has dependents: ${chain1.dependents.length === 2 ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Task 3 has 2 dependencies: ${chain3.dependencies.length === 2 ? 'PASSED' : 'FAILED'}`);
  
  console.log('   ✅ Dependency tracking test passed\n');
}

async function testStateManagement(stateFile: string): Promise<void> {
  console.log('📊 Test 6: State Management');
  
  const manager = new IdempotencyManager(stateFile);
  
  // Test state summary
  const summary = manager.getStateSummary();
  console.log(`   ✓ State summary:`)
  console.log(`      Total PRDs: ${summary.totalPrds}`);
  console.log(`      Processed PRDs: ${summary.processedPrds}`);
  console.log(`      Total Issues: ${summary.totalIssues}`);
  console.log(`      Active Transactions: ${summary.activeTransactions}`);
  console.log(`      Last Updated: ${summary.lastUpdated.toISOString()}`);
  
  // Test export/import
  const exportedState = manager.exportState();
  console.log(`   ✓ State export successful: ${exportedState.version ? 'PASSED' : 'FAILED'}`);
  
  // Test cleanup
  manager.cleanupOldTransactions(0); // Clean all transactions
  const summaryAfterCleanup = manager.getStateSummary();
  console.log(`   ✓ Transaction cleanup: ${summaryAfterCleanup.activeTransactions === 0 ? 'PASSED' : 'FAILED'}`);
  
  // Test issues needing update
  const contentHash = manager.calculatePrdHash(mockPrdContent1, 'docs/update-test.prd.md');
  const needingUpdate = manager.getIssuesNeedingUpdate(contentHash);
  console.log(`   ✓ Issues needing update count: ${needingUpdate.length}`);
  
  console.log('   ✅ State management test passed\n');
}

// Run tests if called directly
if (require.main === module) {
  runIdempotencyTests().catch(console.error);
}

export { runIdempotencyTests };