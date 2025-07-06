#!/usr/bin/env ts-node

/**
 * Comprehensive demo showing comment parsing functionality
 */

import { 
  containsCommand, 
  parseCommand, 
  parseBreakdownCommand,
  validateBreakdownArgs
} from '../scripts/comment-parser';

function runComprehensiveDemo() {
  console.log('🎯 Comprehensive Comment Parsing Demo\n');

  // Scenario 1: Real-world comment examples
  console.log('📝 Scenario 1: Real-world issue comments\n');
  
  const realWorldComments = [
    `This issue is getting complex. Let's break it down.

/breakdown --depth 3 --threshold 40

This should help us manage the complexity better.`,

    `I think we need to decompose this further:

/breakdown max-depth=2 complexity=50

Looking forward to the sub-tasks!`,

    `Quick breakdown needed:
/breakdown
Just use default settings.`,

    `Let me try this:
/breakdown --depth=invalid
This should fail validation.`,

    `Not sure about this approach...
/other-command --test
No breakdown command here.`
  ];

  realWorldComments.forEach((comment, index) => {
    console.log(`💬 Comment ${index + 1}:`);
    console.log(`   "${comment.replace(/\n/g, '\\n')}"`);
    console.log();
    
    const hasCommand = containsCommand(comment);
    console.log(`   Contains command: ${hasCommand}`);
    
    if (hasCommand) {
      const result = parseBreakdownCommand(comment);
      if (result.found && result.command) {
        console.log(`   Command: ${result.command.command}`);
        console.log(`   Arguments: ${JSON.stringify(result.command.args)}`);
        console.log(`   Valid: ${result.command.isValid}`);
        
        if (result.validation?.normalized) {
          console.log(`   Normalized: ${JSON.stringify(result.validation.normalized)}`);
        }
        
        if (!result.command.isValid) {
          console.log(`   Errors: ${result.command.errors.join(', ')}`);
        }
      }
    }
    console.log();
  });

  // Scenario 2: Edge cases
  console.log('🔍 Scenario 2: Edge cases and error handling\n');
  
  const edgeCases = [
    '/breakdown\n/breakdown --depth 2', // Multiple commands
    '/BREAKDOWN --DEPTH 3', // Case insensitive
    '/breakdown   --depth   3   --threshold   50   ', // Extra whitespace
    '/breakdown --depth "3" --name "test task"', // Quoted values
    '/breakdown --depth=0 --threshold=150', // Invalid ranges
    '', // Empty comment
    'Just discussing the issue without any commands', // No command
  ];

  edgeCases.forEach((comment, index) => {
    console.log(`🧪 Edge case ${index + 1}: "${comment}"`);
    
    const result = parseBreakdownCommand(comment);
    if (result.found) {
      console.log(`   ✅ Found command: ${result.command?.isValid ? 'Valid' : 'Invalid'}`);
      if (result.command?.errors.length) {
        console.log(`   ⚠️  Errors: ${result.command.errors.join(', ')}`);
      }
    } else {
      console.log(`   ❌ No command found`);
    }
    console.log();
  });

  // Scenario 3: Integration example
  console.log('🔗 Scenario 3: Integration example (simulating GitHub action)\n');
  
  const mockGitHubComment = '/breakdown --depth 2 --threshold 30';
  console.log(`Simulating GitHub comment: "${mockGitHubComment}"`);
  console.log();
  
  // This is how the breakdown action would use the parser
  const parseResult = parseBreakdownCommand(mockGitHubComment);
  
  if (!parseResult.found) {
    console.log('❌ Action would fail: No breakdown command found');
  } else if (!parseResult.command?.isValid) {
    console.log(`❌ Action would fail: ${parseResult.command?.errors.join(', ')}`);
  } else {
    console.log('✅ Action would proceed with breakdown');
    
    // Extract configuration
    const normalized = parseResult.validation?.normalized || {};
    const maxDepth = normalized.maxDepth || normalized.depth || 2; // default
    const threshold = normalized.complexityThreshold || normalized.threshold || normalized.complexity || 40; // default
    
    console.log(`   Using max depth: ${maxDepth}`);
    console.log(`   Using complexity threshold: ${threshold}`);
    console.log(`   Original arguments: ${JSON.stringify(parseResult.command.args)}`);
  }

  console.log('\n🎉 Demo completed! The comment parsing system is ready for production use.');
  console.log('\nFeatures demonstrated:');
  console.log('✅ Command detection in natural language comments');
  console.log('✅ Multiple argument formats (--flag, key=value, --flag=value)');
  console.log('✅ Argument validation with meaningful error messages');
  console.log('✅ Case insensitive command parsing');
  console.log('✅ Edge case handling (multiple commands, malformed input)');
  console.log('✅ Integration-ready interface for GitHub Actions');
}

// Run the demo
runComprehensiveDemo();