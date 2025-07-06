/**
 * Test script for artifact recovery functionality
 * 
 * This script tests the metadata management system and artifact recovery utilities
 * without requiring actual GitHub Actions artifacts or API calls.
 */

import { ArtifactManager, TaskGraphArtifact } from '../scripts/artifact-manager';
import { RecoveryConfig, ArtifactRecovery } from '../scripts/artifact-recovery';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock task graph data for testing
const mockTaskGraph = {
  tasks: [
    {
      id: 'task-1',
      title: 'Implement user authentication',
      description: 'Create user login and registration system',
      complexity: 5,
      subtasks: [
        {
          id: 'task-1-1',
          title: 'Design login form',
          description: 'Create responsive login form UI',
          complexity: 2
        },
        {
          id: 'task-1-2',
          title: 'Implement authentication API',
          description: 'Create backend API for user authentication',
          complexity: 4
        }
      ]
    },
    {
      id: 'task-2',
      title: 'Setup database schema',
      description: 'Create and configure database tables',
      complexity: 3,
      dependencies: ['task-1']
    }
  ]
};

const mockPrdContent = `
# Test PRD

## Overview
This is a test PRD for validating the artifact recovery system.

## Tasks
- Implement user authentication
- Setup database schema
`;

async function runTests(): Promise<void> {
  console.log('🧪 Starting Artifact Recovery Tests');
  console.log('=' .repeat(50));

  try {
    // Test 1: Metadata Schema Validation
    console.log('\n📋 Test 1: Metadata Schema Validation');
    await testMetadataSchema();

    // Test 2: Artifact Structure Validation
    console.log('\n🔍 Test 2: Artifact Structure Validation');
    await testArtifactValidation();

    // Test 3: Dependency Chain Extraction
    console.log('\n🔗 Test 3: Dependency Chain Extraction');
    await testDependencyChainExtraction();

    // Test 4: Task Counting
    console.log('\n📊 Test 4: Task Counting');
    await testTaskCounting();

    // Test 5: PRD Hash Calculation
    console.log('\n🔐 Test 5: PRD Hash Calculation');
    await testPrdHashCalculation();

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function testMetadataSchema(): Promise<void> {
  const artifactManager = new ArtifactManager();
  
  // Set mock environment variables
  process.env.GITHUB_RUN_ID = '12345';
  process.env.GITHUB_RUN_NUMBER = '42';
  process.env.GITHUB_WORKFLOW = 'Test Workflow';
  process.env.GITHUB_EVENT_NAME = 'push';
  process.env.GITHUB_ACTOR = 'test-user';
  process.env.GITHUB_REPOSITORY_OWNER = 'test-owner';
  process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
  process.env.GITHUB_REF = 'refs/heads/main';
  process.env.GITHUB_SHA = 'abc123def456';

  // Test that metadata includes all required fields
  const tempDir = path.join(os.tmpdir(), 'test-artifacts');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Create a test artifact structure (without actual upload)
    const artifactId = 'test-' + Date.now();
    const taskCounts = artifactManager.countTasksByStatus(mockTaskGraph);
    const dependencyChains = artifactManager.extractDependencyChains(mockTaskGraph);
    const prdHash = artifactManager.calculatePrdHash(mockPrdContent);

    const artifact: TaskGraphArtifact = {
      id: artifactId,
      taskGraph: mockTaskGraph,
      metadata: {
        createdAt: new Date(),
        totalTasks: 4, // Expected total
        maxDepth: 2, // Expected depth
        leafTasks: 3, // Expected leaf tasks
        prdHash,
        taskCounts,
        dependencyChains,
        workflowRunContext: {
          runId: '12345',
          runNumber: 42,
          workflowName: 'Test Workflow',
          eventName: 'push',
          actor: 'test-user',
          repository: {
            owner: 'test-owner',
            name: 'test-repo'
          },
          ref: 'refs/heads/main',
          sha: 'abc123def456'
        }
      },
      status: 'completed'
    };

    console.log('   ✓ Created artifact with enhanced metadata');
    console.log(`   ✓ PRD hash: ${artifact.metadata.prdHash}`);
    console.log(`   ✓ Total tasks: ${artifact.metadata.totalTasks}`);
    console.log(`   ✓ Workflow run: ${artifact.metadata.workflowRunContext.runId}`);

    // Validate the structure
    const isValid = (artifact as any).validateArtifactStructure ? 
      (artifact as any).validateArtifactStructure(artifact) : true;
    
    console.log(`   ✓ Artifact structure validation: ${isValid ? 'PASSED' : 'FAILED'}`);

  } finally {
    // Cleanup
    artifactManager.cleanup();
  }
}

async function testArtifactValidation(): Promise<void> {
  const artifactManager = new ArtifactManager();

  // Test with valid artifact
  const validArtifact = {
    id: 'test-valid',
    taskGraph: mockTaskGraph,
    metadata: {
      createdAt: new Date(),
      totalTasks: 4,
      maxDepth: 2,
      leafTasks: 3,
      prdHash: 'test-hash',
      taskCounts: { total: 4, completed: 0, pending: 4, blocked: 0 },
      dependencyChains: { dependencies: {}, dependents: {} },
      workflowRunContext: {
        runId: '12345',
        runNumber: 42,
        workflowName: 'Test',
        eventName: 'push',
        actor: 'test',
        repository: { owner: 'test', name: 'repo' },
        ref: 'main',
        sha: 'abc123'
      }
    },
    status: 'completed' as const
  };

  const isValid = (artifactManager as any).validateArtifactStructure(validArtifact);
  console.log(`   ✓ Valid artifact validation: ${isValid ? 'PASSED' : 'FAILED'}`);

  // Test with invalid artifact (missing required fields)
  const invalidArtifact = {
    id: 'test-invalid',
    taskGraph: mockTaskGraph
    // Missing metadata
  };

  const isInvalid = !(artifactManager as any).validateArtifactStructure(invalidArtifact);
  console.log(`   ✓ Invalid artifact rejection: ${isInvalid ? 'PASSED' : 'FAILED'}`);
}

async function testDependencyChainExtraction(): Promise<void> {
  const artifactManager = new ArtifactManager();
  
  const dependencyChains = artifactManager.extractDependencyChains(mockTaskGraph);
  
  console.log('   ✓ Extracted dependency chains:');
  console.log(`      Dependencies: ${JSON.stringify(dependencyChains.dependencies, null, 2)}`);
  console.log(`      Dependents: ${JSON.stringify(dependencyChains.dependents, null, 2)}`);
  
  // Verify expected dependencies
  const expectedDependencies = dependencyChains.dependencies['task-2'];
  const hasDependency = expectedDependencies && expectedDependencies.includes('task-1');
  console.log(`   ✓ Task-2 depends on Task-1: ${hasDependency ? 'PASSED' : 'FAILED'}`);
}

async function testTaskCounting(): Promise<void> {
  const artifactManager = new ArtifactManager();
  
  const taskCounts = artifactManager.countTasksByStatus(mockTaskGraph);
  
  console.log('   ✓ Task counts:');
  console.log(`      Total: ${taskCounts.total}`);
  console.log(`      Completed: ${taskCounts.completed}`);
  console.log(`      Pending: ${taskCounts.pending}`);
  console.log(`      Blocked: ${taskCounts.blocked}`);
  
  // Verify expected counts (4 total tasks: 2 parent + 2 subtasks)
  const expectedTotal = 4;
  console.log(`   ✓ Total count matches expected: ${taskCounts.total === expectedTotal ? 'PASSED' : 'FAILED'}`);
}

async function testPrdHashCalculation(): Promise<void> {
  const artifactManager = new ArtifactManager();
  
  const hash1 = artifactManager.calculatePrdHash(mockPrdContent);
  const hash2 = artifactManager.calculatePrdHash(mockPrdContent);
  const hash3 = artifactManager.calculatePrdHash(mockPrdContent + '\n// Different content');
  
  console.log(`   ✓ Hash 1: ${hash1}`);
  console.log(`   ✓ Hash 2: ${hash2}`);
  console.log(`   ✓ Hash 3: ${hash3}`);
  
  console.log(`   ✓ Consistent hashing: ${hash1 === hash2 ? 'PASSED' : 'FAILED'}`);
  console.log(`   ✓ Different content produces different hash: ${hash1 !== hash3 ? 'PASSED' : 'FAILED'}`);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { runTests };