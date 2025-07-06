#!/usr/bin/env node

/**
 * Entry point for Taskmaster Breakdown Action
 * This script bridges the action environment to the main TypeScript implementation
 */

const path = require('path');
const { spawn } = require('child_process');

// Determine if we're running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

// Set working directory to root project
const rootDir = path.resolve(__dirname, '../..');
process.chdir(rootDir);

console.log('🚀 Starting Taskmaster Breakdown...');
console.log(`📂 Working directory: ${process.cwd()}`);
console.log(`🏃 GitHub Actions: ${isGitHubActions ? 'Yes' : 'No'}`);

// Run the main TypeScript file with proper environment
const command = 'npx';
const args = ['ts-node', 'actions/taskmaster-breakdown/src/main.ts'];

const child = spawn(command, args, { 
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_PROJECT: path.join(rootDir, 'tsconfig.json'),
    NODE_PATH: path.join(rootDir, 'node_modules')
  }
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Breakdown action failed with exit code ${code}`);
    process.exit(code);
  }
  console.log('✅ Breakdown action completed successfully');
});

child.on('error', (error) => {
  console.error('❌ Failed to start breakdown action:', error.message);
  process.exit(1);
});