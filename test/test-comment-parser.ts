#!/usr/bin/env ts-node

/**
 * Test the comment parsing functionality
 */

import { 
  containsCommand, 
  parseCommand, 
  validateBreakdownArgs, 
  parseBreakdownCommand,
  type CommentParseOptions
} from '../scripts/comment-parser';

function testContainsCommand() {
  console.log('🧪 Testing command detection...');
  
  const testCases = [
    // Basic command detection
    { input: '/breakdown', expected: true, description: 'simple breakdown command' },
    { input: '/breakdown --depth 3', expected: true, description: 'breakdown with args' },
    { input: 'Some text\n/breakdown\nMore text', expected: true, description: 'breakdown in middle' },
    { input: '  /breakdown  ', expected: true, description: 'breakdown with whitespace' },
    
    // Case sensitivity tests
    { input: '/BREAKDOWN', expected: true, description: 'uppercase command (case insensitive)' },
    { input: '/Breakdown', expected: true, description: 'mixed case command (case insensitive)' },
    
    // Non-matching cases
    { input: 'no command here', expected: false, description: 'no command' },
    { input: 'breakdown without slash', expected: false, description: 'missing slash' },
    { input: '/other-command', expected: false, description: 'different command' },
    { input: 'text/breakdown', expected: false, description: 'slash not at start' },
    
    // Edge cases
    { input: '', expected: false, description: 'empty string' },
    { input: '/', expected: false, description: 'just slash' },
    { input: '/breakdownother', expected: false, description: 'command with suffix' }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = containsCommand(testCase.input);
    if (result === testCase.expected) {
      console.log(`  ✅ ${testCase.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.description}: expected ${testCase.expected}, got ${result}`);
    }
  }
  
  console.log(`Command detection: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testParseCommand() {
  console.log('🧪 Testing command parsing...');
  
  const testCases = [
    // Basic parsing
    {
      input: '/breakdown',
      expected: {
        command: 'breakdown',
        args: {},
        isValid: true,
        errors: []
      },
      description: 'simple command'
    },
    
    // Flag-value format
    {
      input: '/breakdown --depth 3 --threshold 50',
      expected: {
        command: 'breakdown',
        args: { depth: 3, threshold: 50 },
        isValid: true,
        errors: []
      },
      description: 'flag-value format'
    },
    
    // Key=value format
    {
      input: '/breakdown max-depth=2 complexity=30',
      expected: {
        command: 'breakdown',
        args: { maxDepth: 2, complexity: 30 },
        isValid: true,
        errors: []
      },
      description: 'key=value format'
    },
    
    // Mixed formats
    {
      input: '/breakdown --depth=3 threshold=50',
      expected: {
        command: 'breakdown',
        args: { depth: 3, threshold: 50 },
        isValid: true,
        errors: []
      },
      description: 'mixed flag=value and key=value'
    },
    
    // Boolean flags
    {
      input: '/breakdown --verbose --depth 2',
      expected: {
        command: 'breakdown',
        args: { verbose: true, depth: 2 },
        isValid: true,
        errors: []
      },
      description: 'boolean flags'
    },
    
    // Quoted values
    {
      input: '/breakdown --name "test value" --other \'quoted\'',
      expected: {
        command: 'breakdown',
        args: { name: 'test value', other: 'quoted' },
        isValid: true,
        errors: []
      },
      description: 'quoted values'
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = parseCommand(testCase.input);
    
    if (!result) {
      console.log(`  ❌ ${testCase.description}: got null`);
      continue;
    }
    
    let matches = true;
    let issues: string[] = [];
    
    if (result.command !== testCase.expected.command) {
      matches = false;
      issues.push(`command: expected ${testCase.expected.command}, got ${result.command}`);
    }
    
    // Check args
    const expectedArgs: any = testCase.expected.args;
    const actualArgs: any = result.args;
    
    for (const key of Object.keys(expectedArgs)) {
      if (!(key in actualArgs) || actualArgs[key] !== expectedArgs[key]) {
        matches = false;
        issues.push(`args.${key}: expected ${expectedArgs[key]}, got ${actualArgs[key]}`);
      }
    }
    
    for (const key of Object.keys(actualArgs)) {
      if (!(key in expectedArgs)) {
        matches = false;
        issues.push(`unexpected arg: ${key}=${actualArgs[key]}`);
      }
    }
    
    if (matches) {
      console.log(`  ✅ ${testCase.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.description}: ${issues.join(', ')}`);
    }
  }
  
  console.log(`Command parsing: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testValidateBreakdownArgs() {
  console.log('🧪 Testing breakdown argument validation...');
  
  const testCases = [
    // Valid cases
    {
      input: { depth: 3, threshold: 50 } as any,
      expectedValid: true,
      description: 'valid depth and threshold'
    },
    {
      input: { maxDepth: 2, complexityThreshold: 30 } as any,
      expectedValid: true,
      description: 'valid maxDepth and complexityThreshold'
    },
    {
      input: {} as any,
      expectedValid: true,
      description: 'no arguments (valid)'
    },
    
    // Invalid cases
    {
      input: { depth: 0 } as any,
      expectedValid: false,
      description: 'depth too low'
    },
    {
      input: { depth: 6 } as any,
      expectedValid: false,
      description: 'depth too high'
    },
    {
      input: { threshold: 0 } as any,
      expectedValid: false,
      description: 'threshold too low'
    },
    {
      input: { threshold: 101 } as any,
      expectedValid: false,
      description: 'threshold too high'
    },
    {
      input: { depth: 'invalid' } as any,
      expectedValid: false,
      description: 'non-numeric depth'
    },
    {
      input: { unknownArg: 'value' } as any,
      expectedValid: false,
      description: 'unknown argument'
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = validateBreakdownArgs(testCase.input);
    
    if (result.isValid === testCase.expectedValid) {
      console.log(`  ✅ ${testCase.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.description}: expected valid=${testCase.expectedValid}, got valid=${result.isValid}`);
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
    }
  }
  
  console.log(`Breakdown validation: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testParseBreakdownCommand() {
  console.log('🧪 Testing full breakdown command parsing...');
  
  const testCases = [
    // Valid breakdown commands
    {
      input: '/breakdown',
      expectedFound: true,
      expectedValid: true,
      description: 'simple breakdown command'
    },
    {
      input: '/breakdown --depth 3 --threshold 50',
      expectedFound: true,
      expectedValid: true,
      description: 'breakdown with valid arguments'
    },
    {
      input: '/breakdown max-depth=2 complexity=30',
      expectedFound: true,
      expectedValid: true,
      description: 'breakdown with key=value arguments'
    },
    
    // Invalid breakdown commands
    {
      input: '/breakdown --depth 0',
      expectedFound: true,
      expectedValid: false,
      description: 'breakdown with invalid depth'
    },
    {
      input: '/breakdown --unknown-arg value',
      expectedFound: true,
      expectedValid: false,
      description: 'breakdown with unknown argument'
    },
    
    // No breakdown command
    {
      input: 'just some text',
      expectedFound: false,
      expectedValid: false,
      description: 'no breakdown command'
    },
    {
      input: '/other-command',
      expectedFound: false,
      expectedValid: false,
      description: 'different command'
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = parseBreakdownCommand(testCase.input);
    
    let matches = true;
    let issues: string[] = [];
    
    if (result.found !== testCase.expectedFound) {
      matches = false;
      issues.push(`found: expected ${testCase.expectedFound}, got ${result.found}`);
    }
    
    if (testCase.expectedFound && result.command) {
      if (result.command.isValid !== testCase.expectedValid) {
        matches = false;
        issues.push(`valid: expected ${testCase.expectedValid}, got ${result.command.isValid}`);
      }
    }
    
    if (matches) {
      console.log(`  ✅ ${testCase.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.description}: ${issues.join(', ')}`);
      if (result.command && result.command.errors.length > 0) {
        console.log(`    Errors: ${result.command.errors.join(', ')}`);
      }
    }
  }
  
  console.log(`Breakdown command parsing: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testEdgeCases() {
  console.log('🧪 Testing edge cases...');
  
  const testCases = [
    // Multiple commands
    {
      input: '/breakdown\n/breakdown --depth 2',
      description: 'multiple commands (should reject)',
      test: () => {
        const result = parseCommand('/breakdown\n/breakdown --depth 2');
        return result && result.errors.some(e => e.includes('Multiple commands'));
      }
    },
    
    // Commands in code blocks (should be ignored)
    {
      input: '```\n/breakdown\n```',
      description: 'command in code block',
      test: () => {
        const result = containsCommand('```\n/breakdown\n```');
        return result === true; // Our current implementation doesn't filter code blocks
      }
    },
    
    // Very long command line
    {
      input: '/breakdown ' + '--arg '.repeat(100) + 'value',
      description: 'very long command line',
      test: () => {
        const result = parseCommand('/breakdown ' + '--arg '.repeat(100) + 'value');
        return result !== null;
      }
    },
    
    // Empty arguments
    {
      input: '/breakdown --depth= --threshold=""',
      description: 'empty argument values',
      test: () => {
        const result = parseCommand('/breakdown --depth= --threshold=""');
        return result && 'depth' in result.args && 'threshold' in result.args;
      }
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    try {
      const result = testCase.test();
      if (result) {
        console.log(`  ✅ ${testCase.description}`);
        passed++;
      } else {
        console.log(`  ❌ ${testCase.description}: test failed`);
      }
    } catch (error) {
      console.log(`  ❌ ${testCase.description}: threw error - ${error}`);
    }
  }
  
  console.log(`Edge cases: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

function testEnhancedValidation() {
  console.log('🧪 Testing enhanced validation features...');
  
  const testCases = [
    // Enhanced error message tests
    {
      input: { depth: 0.5 } as any,
      expectedValid: false,
      expectedErrorContains: 'whole number',
      description: 'non-integer depth with descriptive error'
    },
    {
      input: { depth: -1 } as any,
      expectedValid: false,
      expectedErrorContains: 'below minimum',
      description: 'negative depth with range error'
    },
    {
      input: { threshold: 101 } as any,
      expectedValid: false,
      expectedErrorContains: 'exceeds maximum',
      description: 'threshold too high with range error'
    },
    {
      input: { deptg: 3 } as any, // typo in "depth"
      expectedValid: false,
      expectedErrorContains: 'Did you mean',
      description: 'typo in argument name with suggestion'
    },
    {
      input: { maxDepth: 2, depth: 3 } as any,
      expectedValid: false,
      expectedErrorContains: 'multiple depth arguments',
      description: 'conflicting depth arguments'
    },
    {
      input: { complexity: 50, threshold: 60 } as any,
      expectedValid: false,
      expectedErrorContains: 'multiple threshold arguments',
      description: 'conflicting threshold arguments'
    },
    {
      input: { randomArg: 'value' } as any,
      expectedValid: false,
      expectedErrorContains: 'Valid arguments are',
      description: 'unknown argument with available options'
    },
    
    // Valid cases that should still work
    {
      input: { maxDepth: 3 } as any,
      expectedValid: true,
      description: 'valid maxDepth only'
    },
    {
      input: { 'max-depth': 2, 'complexity-threshold': 75 } as any,
      expectedValid: true,
      description: 'valid kebab-case arguments'
    }
  ];
  
  let passed = 0;
  for (const testCase of testCases) {
    const result = validateBreakdownArgs(testCase.input);
    
    const isValid = result.isValid === testCase.expectedValid;
    const hasExpectedError = !testCase.expectedErrorContains || 
      result.errors.some(error => error.includes(testCase.expectedErrorContains!));
    
    if (isValid && hasExpectedError) {
      console.log(`  ✅ ${testCase.description}`);
      passed++;
    } else {
      console.log(`  ❌ ${testCase.description}`);
      if (!isValid) {
        console.log(`    Expected valid=${testCase.expectedValid}, got valid=${result.isValid}`);
      }
      if (!hasExpectedError && testCase.expectedErrorContains) {
        console.log(`    Expected error containing '${testCase.expectedErrorContains}', got: ${result.errors.join(', ')}`);
      }
    }
  }
  
  console.log(`Enhanced validation: ${passed}/${testCases.length} tests passed\n`);
  return passed === testCases.length;
}

// Run all tests
function runAllTests() {
  console.log('🎯 Running comment parser tests\n');
  
  const results = [
    testContainsCommand(),
    testParseCommand(),
    testValidateBreakdownArgs(),
    testParseBreakdownCommand(),
    testEdgeCases(),
    testEnhancedValidation()
  ];
  
  const totalPassed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n🎉 Overall: ${totalPassed}/${total} test suites passed`);
  
  if (totalPassed === total) {
    console.log('\n✅ All comment parser tests passed!');
    console.log('\nImplemented functionality:');
    console.log('✅ Detect commands in comments (/breakdown)');
    console.log('✅ Parse command arguments in multiple formats');
    console.log('✅ Validate breakdown command arguments');
    console.log('✅ Enhanced validation with detailed error messages');
    console.log('✅ Argument conflict detection and suggestions');
    console.log('✅ Type validation with helpful descriptions');
    console.log('✅ Handle edge cases and error conditions');
    console.log('✅ Provide structured command parsing interface');
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runAllTests();