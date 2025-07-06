#!/usr/bin/env ts-node

/**
 * Manual test to demonstrate comment parsing integration
 */

import { parseBreakdownCommand } from '../scripts/comment-parser';

function demonstrateCommentParsing() {
  console.log('🎯 Demonstrating Comment Parsing Integration\n');
  
  const testComments = [
    '/breakdown',
    '/breakdown --depth 3 --threshold 50',
    '/breakdown max-depth=2 complexity=30',
    '/breakdown --depth=5',
    'Some discussion text\n\n/breakdown --depth 2\n\nMore discussion',
    '/breakdown --invalid-depth 0',
    'No command here',
    '/breakdown unknown-arg=value'
  ];
  
  for (const comment of testComments) {
    console.log(`📝 Comment: ${JSON.stringify(comment)}`);
    
    const result = parseBreakdownCommand(comment);
    
    if (result.found) {
      console.log(`✅ Found breakdown command`);
      console.log(`   Valid: ${result.command?.isValid}`);
      console.log(`   Args: ${JSON.stringify(result.command?.args)}`);
      
      if (result.validation?.normalized) {
        console.log(`   Normalized: ${JSON.stringify(result.validation.normalized)}`);
      }
      
      if (result.command?.errors && result.command.errors.length > 0) {
        console.log(`   Errors: ${result.command.errors.join(', ')}`);
      }
    } else {
      console.log(`❌ No breakdown command found`);
    }
    
    console.log('');
  }
  
  console.log('🎉 Demo completed successfully!');
}

// Run the demonstration
demonstrateCommentParsing();