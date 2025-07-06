/**
 * Demo script showcasing the enhanced artifact download and validation system
 * 
 * This script demonstrates the key features of the new system:
 * - Enhanced download with comprehensive error handling
 * - Checksum validation
 * - Signature verification framework
 * - Timeout and retry logic
 * - Detailed result reporting
 */

import { ArtifactManager, ArtifactDownloadOptions } from '../scripts/artifact-manager';

async function demonstrateEnhancedDownload(): Promise<void> {
  console.log('🚀 Enhanced Artifact Download and Validation System Demo');
  console.log('=====================================================\n');

  const artifactManager = new ArtifactManager();

  // Demo 1: Basic enhanced download with timeout and retry
  console.log('📦 Demo 1: Enhanced Download with Timeout and Retry');
  const basicOptions: ArtifactDownloadOptions = {
    artifactId: '12345',
    timeout: 5000,      // 5 second timeout
    maxRetries: 2,      // 2 retry attempts
    backoffMultiplier: 1.5,
    initialRetryDelay: 500
  };

  console.log('Configuration:', JSON.stringify(basicOptions, null, 2));
  
  const basicResult = await artifactManager.downloadArtifactEnhanced(basicOptions);
  
  console.log('\nResult Summary:');
  console.log(`✓ Success: ${basicResult.success}`);
  console.log(`✓ Error: ${basicResult.error || 'None'}`);
  console.log(`✓ Retry Attempts: ${basicResult.downloadInfo.retryAttempts}`);
  console.log(`✓ Download Time: ${basicResult.downloadInfo.downloadTime}ms`);
  console.log(`✓ Structure Valid: ${basicResult.validation.structureValid}`);
  console.log(`✓ Metadata Parsed: ${basicResult.validation.metadataParsed}`);

  console.log('\n' + '='.repeat(60) + '\n');

  // Demo 2: Download with checksum validation
  console.log('🔐 Demo 2: Download with Checksum Validation');
  const checksumOptions: ArtifactDownloadOptions = {
    artifactId: '67890',
    checksum: {
      value: 'abc123def456...', // Example SHA256 hash
      algorithm: 'sha256'
    },
    timeout: 10000,
    maxRetries: 3
  };

  console.log('Configuration:', JSON.stringify(checksumOptions, null, 2));
  
  const checksumResult = await artifactManager.downloadArtifactEnhanced(checksumOptions);
  
  console.log('\nResult Summary:');
  console.log(`✓ Success: ${checksumResult.success}`);
  console.log(`✓ Error: ${checksumResult.error || 'None'}`);
  console.log(`✓ Checksum Valid: ${checksumResult.validation.checksumValid ?? 'Not checked'}`);
  console.log(`✓ Structure Valid: ${checksumResult.validation.structureValid}`);
  console.log(`✓ File Size: ${checksumResult.downloadInfo.fileSize} bytes`);

  console.log('\n' + '='.repeat(60) + '\n');

  // Demo 3: Download with signature verification
  console.log('🔏 Demo 3: Download with Signature Verification');
  const signatureOptions: ArtifactDownloadOptions = {
    artifactId: '11111',
    signature: {
      signature: 'digital-signature-data',
      publicKey: 'public-key-pem-data',
      algorithm: 'RSA-SHA256'
    },
    timeout: 15000,
    maxRetries: 1
  };

  console.log('Configuration:', JSON.stringify(signatureOptions, null, 2));
  
  const signatureResult = await artifactManager.downloadArtifactEnhanced(signatureOptions);
  
  console.log('\nResult Summary:');
  console.log(`✓ Success: ${signatureResult.success}`);
  console.log(`✓ Error: ${signatureResult.error || 'None'}`);
  console.log(`✓ Signature Valid: ${signatureResult.validation.signatureValid ?? 'Not checked'}`);
  console.log(`✓ Structure Valid: ${signatureResult.validation.structureValid}`);
  console.log(`✓ Download Time: ${signatureResult.downloadInfo.downloadTime}ms`);

  console.log('\n' + '='.repeat(60) + '\n');

  // Demo 4: Comprehensive download with all features
  console.log('🚀 Demo 4: Comprehensive Download with All Features');
  const comprehensiveOptions: ArtifactDownloadOptions = {
    artifactId: '99999',
    timeout: 30000,                  // 30 second timeout
    maxRetries: 5,                   // 5 retry attempts
    backoffMultiplier: 2,            // Double delay each retry
    initialRetryDelay: 1000,         // Start with 1 second delay
    enhancedMetadataParsing: true,   // Enable enhanced parsing
    checksum: {
      url: 'https://example.com/checksums/artifact-99999.sha256',
      algorithm: 'sha256'
    },
    signature: {
      signatureUrl: 'https://example.com/signatures/artifact-99999.sig',
      publicKey: 'public-key-data',
      algorithm: 'RSA-SHA256'
    }
  };

  console.log('Configuration:', JSON.stringify(comprehensiveOptions, null, 2));
  
  const comprehensiveResult = await artifactManager.downloadArtifactEnhanced(comprehensiveOptions);
  
  console.log('\nDetailed Result Analysis:');
  console.log('========================');
  console.log('General:', {
    success: comprehensiveResult.success,
    error: comprehensiveResult.error || 'None'
  });
  
  console.log('Validation:', comprehensiveResult.validation);
  console.log('Download Info:', comprehensiveResult.downloadInfo);
  
  if (comprehensiveResult.artifact) {
    console.log('Artifact Metadata:', {
      id: comprehensiveResult.artifact.id,
      totalTasks: comprehensiveResult.artifact.metadata.totalTasks,
      status: comprehensiveResult.artifact.status,
      workflowRun: comprehensiveResult.artifact.metadata.workflowRunContext.runId
    });
  }

  console.log('\n✅ Demo completed! All features demonstrated.');
  console.log('\n🔍 Key Features Showcased:');
  console.log('  • Configurable timeout handling');
  console.log('  • Exponential backoff retry logic');
  console.log('  • SHA256/SHA512 checksum validation');
  console.log('  • Digital signature verification framework');
  console.log('  • Enhanced metadata parsing');
  console.log('  • Comprehensive error handling');
  console.log('  • Detailed result reporting');
  console.log('  • Network resilience features');

  // Cleanup
  artifactManager.cleanup();
}

// Run the demo
if (require.main === module) {
  demonstrateEnhancedDownload().catch((error) => {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { demonstrateEnhancedDownload };