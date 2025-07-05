/**
 * Test script to verify artifact upload functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock task data for testing
const mockTaskGraph = {
  tasks: [
    {
      id: 1,
      title: "Main Task 1",
      description: "A main task",
      subtasks: [
        {
          id: 1,
          title: "Subtask 1.1",
          description: "A subtask",
          subtasks: []
        },
        {
          id: 2,
          title: "Subtask 1.2",
          description: "Another subtask",
          subtasks: [
            {
              id: 1,
              title: "Sub-subtask 1.2.1",
              description: "A nested subtask",
              subtasks: []
            }
          ]
        }
      ]
    },
    {
      id: 2,
      title: "Main Task 2",
      description: "Another main task",
      subtasks: []
    }
  ]
};

interface Task {
  id: number;
  title: string;
  description: string;
  subtasks?: Task[];
}

/**
 * Calculate task hierarchy depth recursively
 */
function calculateTaskHierarchyDepth(tasks: Task[]): number {
  let maxDepth = 0;
  
  for (const task of tasks) {
    let currentDepth = 1;
    if (task.subtasks && task.subtasks.length > 0) {
      currentDepth = 1 + calculateTaskHierarchyDepth(task.subtasks);
    }
    maxDepth = Math.max(maxDepth, currentDepth);
  }
  
  return maxDepth;
}

/**
 * Count leaf tasks (tasks without subtasks)
 */
function countLeafTasks(tasks: Task[]): number {
  let leafCount = 0;
  
  for (const task of tasks) {
    if (!task.subtasks || task.subtasks.length === 0) {
      leafCount++;
    } else {
      leafCount += countLeafTasks(task.subtasks);
    }
  }
  
  return leafCount;
}

/**
 * Count total tasks including subtasks
 */
function countTotalTasks(tasks: Task[]): number {
  let totalCount = tasks.length;
  
  for (const task of tasks) {
    if (task.subtasks && task.subtasks.length > 0) {
      totalCount += countTotalTasks(task.subtasks);
    }
  }
  
  return totalCount;
}

async function testArtifactMetadata(): Promise<void> {
  console.log('🧪 Testing Artifact Upload Metadata Calculation');
  
  try {
    // Test metadata calculation functions
    console.log('\n1. Testing metadata calculation functions...');
    
    const totalTasks = countTotalTasks(mockTaskGraph.tasks);
    const leafTasks = countLeafTasks(mockTaskGraph.tasks);
    const hierarchyDepth = calculateTaskHierarchyDepth(mockTaskGraph.tasks);
    
    console.log(`✓ Total Tasks: ${totalTasks} (expected: 5)`);
    console.log(`✓ Leaf Tasks: ${leafTasks} (expected: 3)`);
    console.log(`✓ Hierarchy Depth: ${hierarchyDepth} (expected: 3)`);
    
    // Validate results
    if (totalTasks === 5 && leafTasks === 3 && hierarchyDepth === 3) {
      console.log('✅ All metadata calculations are correct!');
    } else {
      throw new Error('Metadata calculations do not match expected values');
    }
    
    // Test 2: Create temporary task graph file and test size calculation
    console.log('\n2. Testing file size calculation...');
    
    const tempDir = os.tmpdir();
    const testFilePath = path.join(tempDir, 'test-task-graph.json');
    
    fs.writeFileSync(testFilePath, JSON.stringify(mockTaskGraph, null, 2));
    
    const stats = fs.statSync(testFilePath);
    const sizeBytes = stats.size;
    const sizeKB = Math.round(sizeBytes / 1024 * 100) / 100;
    const sizeMB = Math.round(sizeBytes / (1024 * 1024) * 100) / 100;
    
    console.log(`✓ File Size: ${sizeBytes} bytes (${sizeKB} KB, ${sizeMB} MB)`);
    
    // Clean up
    fs.unlinkSync(testFilePath);
    
    console.log('\n✅ All artifact upload tests passed!');
    
  } catch (error) {
    console.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testArtifactMetadata().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { testArtifactMetadata, calculateTaskHierarchyDepth, countLeafTasks, countTotalTasks };