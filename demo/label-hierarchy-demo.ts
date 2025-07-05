#!/usr/bin/env ts-node

/**
 * Demo script showing enhanced label and hierarchy management output
 */

// Mock the create-issues module functionality for demo
interface Task {
  id: number;
  title: string;
  description: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Task[];
}

// Import functions from test file for demo
function generateIssueLabels(task: Task, parentTask?: Task, complexityScore?: number): string[] {
  const labels = ['taskmaster'];
  
  if (task.priority) {
    labels.push(`priority:${task.priority.toLowerCase()}`);
  }
  
  if (task.status) {
    labels.push(`status:${task.status.toLowerCase()}`);
  }
  
  if (parentTask) {
    labels.push('subtask');
    labels.push(`parent:${parentTask.id}`);
  } else {
    labels.push('main-task');
  }
  
  if (complexityScore !== undefined) {
    if (complexityScore >= 8) {
      labels.push('complexity:high');
    } else if (complexityScore >= 5) {
      labels.push('complexity:medium');
    } else {
      labels.push('complexity:low');
    }
  }
  
  if (task.dependencies && task.dependencies.length > 0) {
    labels.push('has-dependencies');
  }
  
  if (task.subtasks && task.subtasks.length > 0) {
    labels.push('has-subtasks');
  }
  
  return labels;
}

function buildIssueTitle(task: Task, parentTask?: Task): string {
  const priorityPrefix = task.priority ? 
    (task.priority.toLowerCase() === 'high' ? '[🔴 HIGH] ' : 
     task.priority.toLowerCase() === 'medium' ? '[🟡 MED] ' : 
     task.priority.toLowerCase() === 'low' ? '[🟢 LOW] ' : '') : '';
  
  if (parentTask) {
    return `${priorityPrefix}[${parentTask.id}.${task.id}] ${task.title}`;
  } else {
    return `${priorityPrefix}[${task.id}] ${task.title}`;
  }
}

function updateDependencyLabels(hasOpenDeps: boolean, openCount: number): string[] {
  if (hasOpenDeps) {
    return ['blocked', `blocked-by:${openCount}`];
  } else {
    return ['ready'];
  }
}

// Demo data representing a real project structure
const sampleTasks: Task[] = [
  {
    id: 1,
    title: 'Setup Repository Structure and Configuration',
    description: 'Initialize the GitHub Action template repository',
    priority: 'high',
    status: 'pending',
    dependencies: [],
    subtasks: [
      {
        id: 1,
        title: 'Create directory structure',
        description: 'Set up basic directory structure',
        priority: 'medium',
        status: 'pending'
      },
      {
        id: 2,
        title: 'Setup action.yml metadata',
        description: 'Create action.yml file',
        priority: 'high',
        status: 'in-progress',
        dependencies: [1]
      }
    ]
  },
  {
    id: 2,
    title: 'Implement CLI Integration',
    description: 'Add taskmaster CLI integration',
    priority: 'medium',
    status: 'pending',
    dependencies: [1]
  },
  {
    id: 3,
    title: 'Create Documentation',
    description: 'Write comprehensive documentation',
    priority: 'low',
    status: 'pending',
    dependencies: [1, 2]
  }
];

// Mock complexity scores
const complexityScores: Record<string, number> = {
  '1': 8,
  '1.1': 3,
  '1.2': 6,
  '2': 7,
  '3': 4
};

// Mock dependency states (simulating some open, some closed dependencies)
const dependencyStates: Record<string, { hasOpen: boolean; openCount: number }> = {
  '1.2': { hasOpen: true, openCount: 1 },  // Blocked by task 1.1
  '2': { hasOpen: true, openCount: 1 },    // Blocked by task 1
  '3': { hasOpen: true, openCount: 2 }     // Blocked by tasks 1 and 2
};

console.log('🎯 Enhanced Label and Hierarchy Management Demo');
console.log('========================================================\n');

console.log('Sample GitHub Issues that would be created:\n');

sampleTasks.forEach(task => {
  // Main task
  const title = buildIssueTitle(task);
  const labels = generateIssueLabels(task, undefined, complexityScores[task.id.toString()]);
  const depLabels = task.dependencies?.length ? 
    updateDependencyLabels(dependencyStates[task.id.toString()]?.hasOpen || false, 
                          dependencyStates[task.id.toString()]?.openCount || 0) : [];
  
  console.log(`📋 Issue: ${title}`);
  console.log(`   Labels: ${[...labels, ...depLabels].join(', ')}`);
  console.log(`   ID: #${100 + task.id}`);
  console.log('');
  
  // Subtasks
  if (task.subtasks) {
    task.subtasks.forEach(subtask => {
      const subTitle = buildIssueTitle(subtask, task);
      const subLabels = generateIssueLabels(subtask, task, complexityScores[`${task.id}.${subtask.id}`]);
      const subDepLabels = subtask.dependencies?.length ? 
        updateDependencyLabels(dependencyStates[`${task.id}.${subtask.id}`]?.hasOpen || false, 
                              dependencyStates[`${task.id}.${subtask.id}`]?.openCount || 0) : [];
      
      console.log(`  📄 Subtask: ${subTitle}`);
      console.log(`     Labels: ${[...subLabels, ...subDepLabels].join(', ')}`);
      console.log(`     ID: #${100 + task.id * 10 + subtask.id}`);
      console.log('');
    });
  }
});

console.log('🔍 Label-based Filtering Examples:');
console.log('=====================================\n');

console.log('High Priority Tasks:');
console.log('  🔍 label:"priority:high"');
console.log('  Results: All tasks marked as [🔴 HIGH] priority\n');

console.log('Blocked Tasks:');
console.log('  🔍 label:"blocked"');
console.log('  Results: Tasks waiting on dependencies\n');

console.log('Ready Tasks:');
console.log('  🔍 label:"ready"');
console.log('  Results: Tasks with all dependencies completed\n');

console.log('Complex Tasks:');
console.log('  🔍 label:"complexity:high"');
console.log('  Results: Tasks requiring expert attention\n');

console.log('Subtasks of Task 1:');
console.log('  🔍 label:"parent:1"');
console.log('  Results: All subtasks belonging to main task #1\n');

console.log('📊 Benefits of Enhanced Labeling:');
console.log('=================================\n');
console.log('✅ Easy visual identification of priority levels');
console.log('✅ Clear parent-child relationships');
console.log('✅ Automatic dependency status tracking');
console.log('✅ Complexity-based task assignment');
console.log('✅ Consistent labeling across project');
console.log('✅ Powerful filtering and querying capabilities');
console.log('✅ Integration with GitHub project boards');
console.log('✅ Automated workflow triggers based on labels\n');