#!/usr/bin/env node

/**
 * Integration test for binary downloader
 * Tests error handling and URL generation
 */

import { downloadBinary, BinaryDownloadOptions } from './binary-downloader';
import { detectPlatform } from './platform-utils';

async function testDownloadErrorHandling() {
  console.log('Testing download error handling...');
  
  try {
    // Test with invalid URL - should fail gracefully
    const options: BinaryDownloadOptions = {
      baseUrl: 'https://invalid-url-that-does-not-exist.com/releases',
      version: '1.0.0',
      storageDir: '/tmp/taskmaster-test-error'
    };
    
    await downloadBinary(options);
    console.log('✗ Expected error but download succeeded');
    return false;
  } catch (error) {
    console.log('✓ Download correctly failed with invalid URL');
    return true;
  }
}

async function testPlatformSpecificBinaryName() {
  console.log('\nTesting platform-specific binary naming...');
  
  try {
    const platform = detectPlatform();
    
    // Test different binary names
    const options: BinaryDownloadOptions = {
      baseUrl: 'https://example.com',
      version: '2.1.0',
      storageDir: '/tmp/test',
      binaryName: 'custom-tool'
    };
    
    const expectedPattern = new RegExp(`custom-tool-2\\.1\\.0-${platform.os}-${platform.arch}`);
    
    // We won't actually download, just check the path generation
    const { getBinaryPath } = await import('./binary-downloader');
    const testPath = getBinaryPath(options.storageDir, options.version, options.binaryName);
    
    if (expectedPattern.test(testPath)) {
      console.log(`✓ Binary path correctly formatted: ${testPath}`);
      return true;
    } else {
      console.log(`✗ Binary path incorrect: ${testPath}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Platform-specific naming failed: ${error}`);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('Running integration tests for binary downloader...\n');
  
  const errorTest = await testDownloadErrorHandling();
  const namingTest = await testPlatformSpecificBinaryName();
  
  console.log('\n--- Integration Test Results ---');
  console.log(`Error handling: ${errorTest ? 'PASS' : 'FAIL'}`);
  console.log(`Binary naming: ${namingTest ? 'PASS' : 'FAIL'}`);
  
  const allPassed = errorTest && namingTest;
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Only run if this file is executed directly
if (require.main === module) {
  runIntegrationTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Integration test runner failed:', error);
    process.exit(1);
  });
}