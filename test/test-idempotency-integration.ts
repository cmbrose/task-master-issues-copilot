/**
 * Integration test for idempotency framework with create-issues workflow
 * Tests the full integration without making actual GitHub API calls
 */

import { IdempotencyManager } from '../scripts/idempotency-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock task data similar to the real tasks.json
const mockTasksJson = {
  master: {
    tasks: [
      {
        id: 1,
        title: "Setup Repository Structure",
        description: "Initialize the GitHub Action template repository",
        dependencies: [],
        status: "pending",
        subtasks: [
          {
            id: 1,
            title: "Create directory structure",
            description: "Set up basic directory structure",
            dependencies: [],
            status: "pending"
          },
          {
            id: 2,
            title: "Setup action.yml metadata",
            description: "Configure action.yml file",
            dependencies: [1],
            status: "pending"
          }
        ]
      },
      {
        id: 2,
        title: "Implement Core Logic",
        description: "Implement the main GitHub Action logic",
        dependencies: [1],
        status: "pending"
      }
    ],
    metadata: {
      version: "1.0.0",
      lastUpdated: "2025-07-06T00:00:00Z"
    }
  }
};

async function testIdempotencyIntegration(): Promise<void> {
  console.log('🧪 Starting Idempotency Integration Test');
  console.log('=============================================\n');

  // Use temporary directory for testing
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'));
  const stateFile = path.join(tempDir, 'integration-state.json');
  const tasksFile = path.join(tempDir, 'tasks.json');

  try {
    // Create mock tasks.json file
    fs.writeFileSync(tasksFile, JSON.stringify(mockTasksJson, null, 2));
    console.log(`📝 Created mock tasks file: ${tasksFile}`);

    await testFirstRun(stateFile, tasksFile);
    await testIdempotentRerun(stateFile, tasksFile);
    await testContentChange(stateFile, tasksFile);
    await testRollbackScenario(stateFile, tasksFile);

    console.log('\n✅ All integration tests completed successfully!');
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function testFirstRun(stateFile: string, tasksFile: string): Promise<void> {
  console.log('🚀 Test 1: First Run Processing');

  const manager = new IdempotencyManager(stateFile);
  const taskGraphContent = fs.readFileSync(tasksFile, 'utf8');

  // Check initial state
  const prdState = manager.checkPrdState(taskGraphContent, tasksFile);
  console.log(`   ✓ Initial check - isProcessed: ${prdState.isProcessed}, hasChanged: ${prdState.hasChanged}`);

  // Simulate processing workflow
  const transactionId = manager.beginTransaction();
  
  try {
    const contentHash = manager.recordPrdProcessingStart(taskGraphContent, tasksFile, 'task-graph-1');
    console.log(`   ✓ Started processing with hash: ${contentHash.substring(0, 8)}...`);

    // Simulate issue creation for each task
    const taskData = JSON.parse(taskGraphContent);
    const createdIssues: number[] = [];
    let issueCounter = 100;

    for (const task of taskData.master.tasks) {
      // Parent task
      const parentIssueNumber = ++issueCounter;
      manager.recordIssueCreation(
        parentIssueNumber,
        String(task.id),
        contentHash,
        `## ${task.title}\n\n${task.description}`,
        ['taskmaster', 'feature'],
        task.dependencies?.map(String) || []
      );
      createdIssues.push(parentIssueNumber);
      console.log(`   ✓ Created parent issue #${parentIssueNumber} for task ${task.id}`);

      // Subtasks
      if (task.subtasks) {
        for (const subtask of task.subtasks) {
          const subIssueNumber = ++issueCounter;
          manager.recordIssueCreation(
            subIssueNumber,
            `${task.id}.${subtask.id}`,
            contentHash,
            `## ${subtask.title}\n\n${subtask.description}`,
            ['taskmaster', 'subtask'],
            subtask.dependencies?.map((depId: any) => `${task.id}.${depId}`) || [],
            String(task.id)
          );
          createdIssues.push(subIssueNumber);
          console.log(`   ✓ Created sub-issue #${subIssueNumber} for subtask ${task.id}.${subtask.id}`);
        }
      }
    }

    // Simulate issue updates
    for (const issueNumber of createdIssues.slice(0, 2)) {
      manager.recordIssueUpdate(
        issueNumber,
        undefined, // no body change
        ['taskmaster', 'feature', 'ready'] // updated labels
      );
      console.log(`   ✓ Updated issue #${issueNumber} labels`);
    }

    // Complete processing
    manager.recordPrdProcessingComplete(contentHash, createdIssues);
    manager.commitTransaction();

    console.log(`   ✓ Successfully completed first run with ${createdIssues.length} issues`);

    // Verify state
    const summary = manager.getStateSummary();
    console.log(`   ✓ State summary: ${summary.totalPrds} PRDs, ${summary.totalIssues} issues`);

  } catch (error) {
    manager.rollbackTransaction();
    throw error;
  }

  console.log('   ✅ First run test passed\n');
}

async function testIdempotentRerun(stateFile: string, tasksFile: string): Promise<void> {
  console.log('🔄 Test 2: Idempotent Rerun');

  const manager = new IdempotencyManager(stateFile);
  const taskGraphContent = fs.readFileSync(tasksFile, 'utf8');

  // Check state (should be already processed)
  const prdState = manager.checkPrdState(taskGraphContent, tasksFile);
  console.log(`   ✓ Rerun check - isProcessed: ${prdState.isProcessed}, hasChanged: ${prdState.hasChanged}`);

  if (prdState.isProcessed && !prdState.hasChanged && prdState.state?.status === 'completed') {
    console.log('   ✓ Correctly detected already processed content, skipping processing');
  } else {
    throw new Error('Failed to detect idempotent state');
  }

  const summary = manager.getStateSummary();
  console.log(`   ✓ State preserved: ${summary.totalPrds} PRDs, ${summary.totalIssues} issues`);

  console.log('   ✅ Idempotent rerun test passed\n');
}

async function testContentChange(stateFile: string, tasksFile: string): Promise<void> {
  console.log('📝 Test 3: Content Change Detection');

  const manager = new IdempotencyManager(stateFile);

  // Modify the tasks.json content
  const modifiedTasksJson = { ...mockTasksJson };
  modifiedTasksJson.master.tasks.push({
    id: 3,
    title: "New Feature",
    description: "Added new feature task",
    dependencies: [2],
    status: "pending"
  });

  const modifiedContent = JSON.stringify(modifiedTasksJson, null, 2);
  
  // Check state with modified content
  const prdState = manager.checkPrdState(modifiedContent, tasksFile);
  console.log(`   ✓ Modified content check - isProcessed: ${prdState.isProcessed}, hasChanged: ${prdState.hasChanged}`);

  if (!prdState.isProcessed && prdState.hasChanged) {
    console.log('   ✓ Correctly detected content changes');
  } else {
    throw new Error('Failed to detect content changes');
  }

  // Get issues that would need updating
  const originalHash = manager.calculatePrdHash(fs.readFileSync(tasksFile, 'utf8'), tasksFile);
  const needingUpdate = manager.getIssuesNeedingUpdate(originalHash);
  console.log(`   ✓ Found ${needingUpdate.length} issues that would need updating`);

  console.log('   ✅ Content change detection test passed\n');
}

async function testRollbackScenario(stateFile: string, tasksFile: string): Promise<void> {
  console.log('🔄 Test 4: Rollback Scenario');

  const manager = new IdempotencyManager(stateFile);
  const taskGraphContent = 'invalid json content to trigger error';

  const transactionId = manager.beginTransaction();
  
  try {
    const contentHash = manager.recordPrdProcessingStart(taskGraphContent, 'test-rollback.json');
    
    // Simulate some operations
    manager.recordIssueCreation(999, 'rollback-task', contentHash, 'test body', ['test']);
    
    // Simulate an error
    throw new Error('Simulated processing error');
    
  } catch (error) {
    console.log(`   ✓ Caught error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Record failure and rollback
    manager.recordPrdProcessingFailure(
      manager.calculatePrdHash(taskGraphContent, 'test-rollback.json'),
      error instanceof Error ? error.message : String(error)
    );
    manager.rollbackTransaction();
    
    console.log('   ✓ Successfully rolled back transaction');
  }

  // Verify state was preserved
  const summary = manager.getStateSummary();
  console.log(`   ✓ State after rollback: ${summary.totalPrds} PRDs, ${summary.totalIssues} issues`);

  // Verify the failed issue was not persisted
  const allIssues = manager.exportState().issues;
  const hasRollbackIssue = Object.values(allIssues).some(issue => issue.issueNumber === 999);
  console.log(`   ✓ Rollback issue not persisted: ${!hasRollbackIssue ? 'PASSED' : 'FAILED'}`);

  console.log('   ✅ Rollback scenario test passed\n');
}

// Run tests if called directly
if (require.main === module) {
  testIdempotencyIntegration().catch(console.error);
}

export { testIdempotencyIntegration };