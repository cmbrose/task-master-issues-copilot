#!/usr/bin/env ts-node
/**
 * Test script to verify the artifact upload path structure
 */

import * as fs from 'fs';
import * as path from 'path';

// Test the directory creation and file copying logic
function testArtifactDirectoryStructure(): void {
  console.log('🧪 Testing Artifact Directory Structure Creation');
  
  try {
    // Create a temporary task graph file for testing
    const testTaskGraph = {
      tasks: [
        {
          id: 1,
          title: "Test Task",
          description: "Test description",
          subtasks: []
        }
      ]
    };
    
    const tempTaskGraphPath = path.join(process.cwd(), 'temp_test_task_graph.json');
    fs.writeFileSync(tempTaskGraphPath, JSON.stringify(testTaskGraph, null, 2));
    
    // Test the artifact directory structure creation
    const tempArtifactDir = path.join(process.cwd(), 'temp_artifacts_test');
    const artifactTaskmasterDir = path.join(tempArtifactDir, 'artifacts', 'taskmaster');
    const artifactTaskGraphPath = path.join(artifactTaskmasterDir, 'task-graph.json');
    
    console.log('📁 Creating directory structure...');
    
    // Ensure the directory structure exists
    fs.mkdirSync(artifactTaskmasterDir, { recursive: true });
    
    // Copy the task graph to the required path
    fs.copyFileSync(tempTaskGraphPath, artifactTaskGraphPath);
    
    // Verify the structure was created correctly
    console.log('✅ Verifying directory structure:');
    
    if (fs.existsSync(tempArtifactDir)) {
      console.log('  ✓ temp_artifacts_test directory exists');
    } else {
      throw new Error('temp_artifacts_test directory was not created');
    }
    
    if (fs.existsSync(path.join(tempArtifactDir, 'artifacts'))) {
      console.log('  ✓ artifacts directory exists');
    } else {
      throw new Error('artifacts directory was not created');
    }
    
    if (fs.existsSync(artifactTaskmasterDir)) {
      console.log('  ✓ artifacts/taskmaster directory exists');
    } else {
      throw new Error('artifacts/taskmaster directory was not created');
    }
    
    if (fs.existsSync(artifactTaskGraphPath)) {
      console.log('  ✓ artifacts/taskmaster/task-graph.json file exists');
    } else {
      throw new Error('artifacts/taskmaster/task-graph.json file was not created');
    }
    
    // Verify the content was copied correctly
    const copiedContent = fs.readFileSync(artifactTaskGraphPath, 'utf8');
    const originalContent = fs.readFileSync(tempTaskGraphPath, 'utf8');
    
    if (copiedContent === originalContent) {
      console.log('  ✓ File content matches original');
    } else {
      throw new Error('File content does not match original');
    }
    
    console.log('');
    console.log('📊 Directory structure verification:');
    console.log(`  • Root: ${tempArtifactDir}`);
    console.log(`  • Artifact path: artifacts/taskmaster/task-graph.json`);
    console.log(`  • Full path: ${artifactTaskGraphPath}`);
    
    // Clean up test files
    fs.rmSync(tempArtifactDir, { recursive: true, force: true });
    fs.rmSync(tempTaskGraphPath, { force: true });
    
    console.log('🧹 Cleaned up test files');
    console.log('');
    console.log('✅ Artifact directory structure test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testArtifactDirectoryStructure();
}

export { testArtifactDirectoryStructure };