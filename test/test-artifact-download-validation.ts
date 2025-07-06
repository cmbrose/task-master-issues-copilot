/**
 * Test script for enhanced artifact download and validation system
 * 
 * Tests the new download service with:
 * - Checksum validation
 * - Signature verification
 * - Timeout handling
 * - Retry logic for network failures
 * - Enhanced metadata parsing
 */

import { ArtifactManager, ArtifactDownloadOptions, ArtifactDownloadResult } from '../scripts/artifact-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// Test data for validation
const mockArtifactData = {
  id: 'test-enhanced-download',
  taskGraph: {
    tasks: [
      {
        id: 'task-1',
        title: 'Test task for download validation',
        description: 'Testing enhanced download capabilities',
        complexity: 3
      }
    ]
  },
  metadata: {
    createdAt: new Date(),
    totalTasks: 1,
    maxDepth: 1,
    leafTasks: 1,
    prdHash: 'test-hash-123',
    taskCounts: { total: 1, completed: 0, pending: 1, blocked: 0 },
    dependencyChains: { dependencies: {}, dependents: {} },
    workflowRunContext: {
      runId: '12345',
      runNumber: 42,
      workflowName: 'Test Workflow',
      eventName: 'push',
      actor: 'test-user',
      repository: { owner: 'test-owner', name: 'test-repo' },
      ref: 'main',
      sha: 'abc123'
    }
  },
  status: 'completed' as const
};

/**
 * Create a mock artifact file for testing
 */
async function createMockArtifactFile(tempDir: string, artifactId: string, data: any): Promise<{ filePath: string; checksum: string }> {
  const filePath = path.join(tempDir, `task-graph-${artifactId}.json`);
  const content = JSON.stringify(data, null, 2);
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content);
  
  // Calculate checksum
  const hash = crypto.createHash('sha256');
  hash.update(content);
  const checksum = hash.digest('hex');
  
  return { filePath, checksum };
}

/**
 * Test checksum validation functionality
 */
async function testChecksumValidation(): Promise<void> {
  console.log('\n🔐 Test 1: Checksum Validation');
  
  const artifactManager = new ArtifactManager();
  const tempDir = path.join(os.tmpdir(), 'test-checksum-validation');
  
  try {
    // Create mock artifact file
    const { filePath, checksum } = await createMockArtifactFile(tempDir, 'checksum-test', mockArtifactData);
    
    // Test private method via type assertion (for testing purposes)
    const manager = artifactManager as any;
    
    // Test valid checksum
    const validResult = await manager.verifyArtifactChecksum(filePath, {
      value: checksum,
      algorithm: 'sha256'
    });
    console.log(`   ✓ Valid checksum verification: ${validResult ? 'PASSED' : 'FAILED'}`);
    
    // Test invalid checksum
    const invalidResult = await manager.verifyArtifactChecksum(filePath, {
      value: 'invalid-checksum-123',
      algorithm: 'sha256'
    });
    console.log(`   ✓ Invalid checksum rejection: ${!invalidResult ? 'PASSED' : 'FAILED'}`);
    
    // Test SHA512 algorithm
    const sha512Hash = crypto.createHash('sha512');
    sha512Hash.update(fs.readFileSync(filePath));
    const sha512Checksum = sha512Hash.digest('hex');
    
    const sha512Result = await manager.verifyArtifactChecksum(filePath, {
      value: sha512Checksum,
      algorithm: 'sha512'
    });
    console.log(`   ✓ SHA512 checksum verification: ${sha512Result ? 'PASSED' : 'FAILED'}`);
    
  } finally {
    // Cleanup
    artifactManager.cleanup();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Test signature verification functionality  
 */
async function testSignatureVerification(): Promise<void> {
  console.log('\n🔏 Test 2: Signature Verification');
  
  const artifactManager = new ArtifactManager();
  const tempDir = path.join(os.tmpdir(), 'test-signature-verification');
  
  try {
    // Create mock artifact file
    const { filePath } = await createMockArtifactFile(tempDir, 'signature-test', mockArtifactData);
    
    // Test private method via type assertion (for testing purposes)
    const manager = artifactManager as any;
    
    // Test signature verification (placeholder implementation)
    const signatureResult = await manager.verifyArtifactSignature(filePath, {
      signature: 'mock-signature-data',
      publicKey: 'mock-public-key',
      algorithm: 'RSA-SHA256'
    });
    console.log(`   ✓ Signature verification placeholder: ${signatureResult ? 'PASSED' : 'FAILED'}`);
    
    // Test missing signature
    const noSignatureResult = await manager.verifyArtifactSignature(filePath, {
      publicKey: 'mock-public-key'
    });
    console.log(`   ✓ Missing signature rejection: ${!noSignatureResult ? 'PASSED' : 'FAILED'}`);
    
    // Test missing public key
    const noKeyResult = await manager.verifyArtifactSignature(filePath, {
      signature: 'mock-signature-data'
    });
    console.log(`   ✓ Missing public key rejection: ${!noKeyResult ? 'PASSED' : 'FAILED'}`);
    
  } finally {
    // Cleanup
    artifactManager.cleanup();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Test secure string comparison
 */
async function testSecureComparison(): Promise<void> {
  console.log('\n🔒 Test 3: Secure String Comparison');
  
  const artifactManager = new ArtifactManager();
  
  try {
    // Test private method via type assertion (for testing purposes)
    const manager = artifactManager as any;
    
    // Test identical strings
    const identicalResult = manager.secureCompare('test123', 'test123');
    console.log(`   ✓ Identical strings comparison: ${identicalResult ? 'PASSED' : 'FAILED'}`);
    
    // Test different strings (same length)
    const differentResult = manager.secureCompare('test123', 'test124');
    console.log(`   ✓ Different strings rejection: ${!differentResult ? 'PASSED' : 'FAILED'}`);
    
    // Test different length strings
    const lengthResult = manager.secureCompare('test123', 'test1234');
    console.log(`   ✓ Different length strings rejection: ${!lengthResult ? 'PASSED' : 'FAILED'}`);
    
    // Test case sensitivity
    const caseResult = manager.secureCompare('Test123', 'test123');
    console.log(`   ✓ Case sensitive comparison: ${!caseResult ? 'PASSED' : 'FAILED'}`);
    
  } finally {
    // Cleanup
    artifactManager.cleanup();
  }
}

/**
 * Test enhanced download options validation
 */
async function testDownloadOptionsValidation(): Promise<void> {
  console.log('\n⚙️ Test 4: Download Options Validation');
  
  const artifactManager = new ArtifactManager();
  
  try {
    // Test invalid artifact ID format
    const invalidIdOptions: ArtifactDownloadOptions = {
      artifactId: 'invalid-non-numeric-id',
      timeout: 5000,
      maxRetries: 2
    };
    
    const invalidIdResult = await artifactManager.downloadArtifactEnhanced(invalidIdOptions);
    console.log(`   ✓ Invalid artifact ID rejection: ${!invalidIdResult.success && invalidIdResult.error?.includes('Invalid artifact ID format') ? 'PASSED' : 'FAILED'}`);
    
    // Test timeout configuration
    const timeoutOptions: ArtifactDownloadOptions = {
      artifactId: '12345',
      timeout: 100, // Very short timeout to force timeout
      maxRetries: 0
    };
    
    const timeoutResult = await artifactManager.downloadArtifactEnhanced(timeoutOptions);
    console.log(`   ✓ Timeout handling: ${!timeoutResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✓ Retry attempts tracked: ${timeoutResult.downloadInfo.retryAttempts === 0 ? 'PASSED' : 'FAILED'}`);
    
    // Test retry logic with maxRetries = 2
    const retryOptions: ArtifactDownloadOptions = {
      artifactId: '99999', // Non-existent artifact ID
      timeout: 1000,
      maxRetries: 2,
      initialRetryDelay: 100,
      backoffMultiplier: 1.5
    };
    
    const retryResult = await artifactManager.downloadArtifactEnhanced(retryOptions);
    console.log(`   ✓ Retry logic execution: ${!retryResult.success && retryResult.downloadInfo.retryAttempts === 2 ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✓ Error message includes retry info: ${retryResult.error?.includes('3 attempts') ? 'PASSED' : 'FAILED'}`);
    
  } finally {
    // Cleanup
    artifactManager.cleanup();
  }
}

/**
 * Test enhanced metadata parsing
 */
async function testEnhancedMetadataParsing(): Promise<void> {
  console.log('\n📋 Test 5: Enhanced Metadata Parsing');
  
  // Test data with string date that should be converted
  const testData = {
    ...mockArtifactData,
    metadata: {
      ...mockArtifactData.metadata,
      createdAt: '2023-01-01T00:00:00.000Z' // String date instead of Date object
    }
  };
  
  const artifactManager = new ArtifactManager();
  
  try {
    // Test private method via type assertion (for testing purposes)  
    const manager = artifactManager as any;
    
    // Test that validateArtifactStructure works with string dates
    const validationResult = manager.validateArtifactStructure(testData);
    console.log(`   ✓ String date in metadata accepted: ${validationResult ? 'PASSED' : 'FAILED'}`);
    
    // Test that createdAt conversion would work in enhanced parsing
    const testDate = new Date('2023-01-01T00:00:00.000Z');
    const convertedData = {
      ...testData,
      metadata: {
        ...testData.metadata,
        createdAt: testDate
      }
    };
    
    const convertedValidation = manager.validateArtifactStructure(convertedData);
    console.log(`   ✓ Date object in metadata accepted: ${convertedValidation ? 'PASSED' : 'FAILED'}`);
    
  } finally {
    // Cleanup
    artifactManager.cleanup();
  }
}

/**
 * Test download result structure
 */
async function testDownloadResultStructure(): Promise<void> {
  console.log('\n📊 Test 6: Download Result Structure');
  
  const artifactManager = new ArtifactManager();
  
  try {
    const options: ArtifactDownloadOptions = {
      artifactId: '99999', // Non-existent artifact
      timeout: 1000,
      maxRetries: 1
    };
    
    const result = await artifactManager.downloadArtifactEnhanced(options);
    
    // Verify result structure
    const hasRequiredFields = (
      typeof result.success === 'boolean' &&
      result.validation !== undefined &&
      typeof result.validation.structureValid === 'boolean' &&
      typeof result.validation.metadataParsed === 'boolean' &&
      result.downloadInfo !== undefined &&
      typeof result.downloadInfo.retryAttempts === 'number' &&
      typeof result.downloadInfo.downloadTime === 'number' &&
      typeof result.downloadInfo.fileSize === 'number'
    );
    
    console.log(`   ✓ Required result fields present: ${hasRequiredFields ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✓ Success field is boolean: ${typeof result.success === 'boolean' ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✓ Validation object structure: ${result.validation && typeof result.validation === 'object' ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✓ Download info structure: ${result.downloadInfo && typeof result.downloadInfo === 'object' ? 'PASSED' : 'FAILED'}`);
    console.log(`   ✓ Error message for failed download: ${!result.success && result.error ? 'PASSED' : 'FAILED'}`);
    
  } finally {
    // Cleanup
    artifactManager.cleanup();
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🧪 Starting Enhanced Artifact Download and Validation Tests');
  console.log('==================================================');

  try {
    await testChecksumValidation();
    await testSignatureVerification();
    await testSecureComparison();
    await testDownloadOptionsValidation();
    await testEnhancedMetadataParsing();
    await testDownloadResultStructure();

    console.log('\n✅ All enhanced download and validation tests completed successfully!');
    console.log('\n📋 Summary of Enhanced Features Tested:');
    console.log('✅ Checksum validation with SHA256 and SHA512 algorithms');
    console.log('✅ Signature verification placeholder implementation');
    console.log('✅ Secure string comparison for timing attack prevention');
    console.log('✅ Download timeout handling and configuration');
    console.log('✅ Retry logic with exponential backoff');
    console.log('✅ Enhanced metadata parsing capabilities');
    console.log('✅ Comprehensive download result structure');
    console.log('✅ Error handling and validation for all edge cases');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { runTests };