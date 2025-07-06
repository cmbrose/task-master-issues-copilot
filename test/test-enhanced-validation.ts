#!/usr/bin/env ts-node

/**
 * Test enhanced validation features
 */

import { parseBreakdownCommand, validateBreakdownArgs } from '../scripts/comment-parser';

function testValueParsing() {
  console.log('🧪 Testing enhanced value parsing...');
  
  const testCases = [
    // Test empty values
    { 
      input: '/breakdown --depth= --threshold=50', 
      description: 'empty argument value',
      expectError: true,
      errorContains: 'Empty argument values'
    },
    
    // Test quoted empty strings  
    { 
      input: '/breakdown --depth="" --threshold=50', 
      description: 'empty quoted string',
      expectError: true,
      errorContains: 'Quoted strings cannot be empty'
    },
    
    // Test invalid boolean-like values
    { 
      input: '/breakdown --verbose=yes', 
      description: 'yes instead of true',
      expectError: true,
      errorContains: "Use 'true' or 'false'"
    },
    
    // Test large numbers
    { 
      input: '/breakdown --depth=999999999999999999999', 
      description: 'extremely large number',
      expectError: true,
      errorContains: 'outside safe integer range'
    },
    
    // Test invalid decimal
    { 
      input: '/breakdown --threshold=50.abc', 
      description: 'invalid decimal format',
      expectError: true,
      errorContains: 'Invalid decimal number'
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = parseBreakdownCommand(testCase.input);
    
    if (testCase.expectError) {
      const hasExpectedError = result.command?.errors?.some(error => 
        error.includes(testCase.errorContains)
      ) || false;
      
      if (hasExpectedError) {
        console.log(`  ✅ ${testCase.description}`);
        passed++;
      } else {
        console.log(`  ❌ ${testCase.description}`);
        console.log(`    Expected error containing '${testCase.errorContains}'`);
        console.log(`    Got errors: ${result.command?.errors?.join(', ') || 'none'}`);
      }
    }
  }
  
  console.log(`Value parsing: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testValidationErrorMessages() {
  console.log('🧪 Testing validation error message quality...');
  
  const testCases = [
    {
      args: { depth: 'not-a-number' } as any,
      description: 'string instead of number',
      expectedErrors: ['must be a number']
    },
    {
      args: { maxDepth: 0.5 } as any,
      description: 'decimal instead of integer for depth',
      expectedErrors: ['whole number']
    },
    {
      args: { threshold: -5 } as any,
      description: 'negative threshold',
      expectedErrors: ['below minimum']
    },
    {
      args: { complexity: 150 } as any,
      description: 'threshold too high',
      expectedErrors: ['exceeds maximum']
    },
    {
      args: { deph: 3 } as any, // typo
      description: 'typo in argument name',
      expectedErrors: ['Did you mean']
    },
    {
      args: { maxDepth: 2, depth: 3 } as any,
      description: 'conflicting depth arguments',
      expectedErrors: ['multiple depth arguments']
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = validateBreakdownArgs(testCase.args);
    
    const hasAllExpectedErrors = testCase.expectedErrors.every(expectedError =>
      result.errors.some(error => error.includes(expectedError))
    );
    
    if (hasAllExpectedErrors && !result.isValid) {
      console.log(`  ✅ ${testCase.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.description}`);
      console.log(`    Expected errors containing: ${testCase.expectedErrors.join(', ')}`);
      console.log(`    Got errors: ${result.errors.join(', ')}`);
    }
  }
  
  console.log(`Error messages: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testArgumentSuggestions() {
  console.log('🧪 Testing argument name suggestions...');
  
  const testCases = [
    {
      args: { deph: 3 } as any, // missing 't' in depth
      description: 'typo in depth',
      shouldSuggest: 'depth'
    },
    {
      args: { treshold: 50 } as any, // missing 'h' in threshold
      description: 'typo in threshold',
      shouldSuggest: 'threshold'
    },
    {
      args: { complexity_threshold: 75 } as any, // underscore instead of hyphen
      description: 'underscore instead of hyphen',
      shouldSuggest: 'complexityThreshold'
    },
    {
      args: { randomInvalidArg: 'value' } as any,
      description: 'completely unknown argument',
      shouldSuggest: null // Should show valid arguments list instead
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = validateBreakdownArgs(testCase.args);
    
    const errorMsg = result.errors.find(error => error.includes('Unknown argument'));
    
    if (testCase.shouldSuggest) {
      const hasSuggestion = errorMsg?.includes('Did you mean') && errorMsg.includes(testCase.shouldSuggest);
      if (hasSuggestion) {
        console.log(`  ✅ ${testCase.description}`);
        passed++;
      } else {
        console.log(`  ❌ ${testCase.description}`);
        console.log(`    Expected suggestion for '${testCase.shouldSuggest}'`);
        console.log(`    Got: ${errorMsg || 'no error message'}`);
      }
    } else {
      const hasValidArgsList = errorMsg?.includes('Valid arguments are');
      if (hasValidArgsList) {
        console.log(`  ✅ ${testCase.description}`);
        passed++;
      } else {
        console.log(`  ❌ ${testCase.description}`);
        console.log(`    Expected 'Valid arguments are' list`);
        console.log(`    Got: ${errorMsg || 'no error message'}`);
      }
    }
  }
  
  console.log(`Argument suggestions: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function runAllEnhancedTests() {
  console.log('🎯 Running enhanced validation tests\n');
  
  const results = [
    testValueParsing(),
    testValidationErrorMessages(),
    testArgumentSuggestions()
  ];
  
  const totalPassed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n🎉 Enhanced validation: ${totalPassed}/${total} test suites passed`);
  
  if (totalPassed === total) {
    console.log('\n✅ All enhanced validation tests passed!');
    console.log('\nNew validation features verified:');
    console.log('✅ Enhanced error messages with detailed descriptions');
    console.log('✅ Argument type validation with helpful hints'); 
    console.log('✅ Argument name suggestions for common typos');
    console.log('✅ Conflict detection for mutually exclusive arguments');
    console.log('✅ Input sanitization and edge case handling');
    console.log('✅ Range validation with clear min/max messages');
  } else {
    console.log('\n❌ Some enhanced validation tests failed');
    process.exit(1);
  }
}

// Run the enhanced tests
runAllEnhancedTests();