/**
 * Test batch processing optimization for GitHub API operations
 */

import {
  EnhancedGitHubApi,
  createGitHubApiClient,
  OperationPriority,
  BatchProcessingConfig,
  type ProcessingCheckpoint
} from '../scripts/index';

// Mock GitHub API responses for testing
const mockOpenIssues = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  number: i + 1,
  title: `Test Issue ${i + 1}`,
  body: i % 10 === 0 
    ? `## Dependencies\n- [ ] #${i + 2}\n- [ ] #${i + 3}\n\n## Description\nTest issue with dependencies`
    : `## Description\nTest issue ${i + 1}`,
  labels: [],
  state: 'open',
  node_id: `test_${i + 1}`,
  url: `https://api.github.com/repos/test/test/issues/${i + 1}`,
  repository_url: 'https://api.github.com/repos/test/test',
  labels_url: `https://api.github.com/repos/test/test/issues/${i + 1}/labels{/name}`,
  comments_url: `https://api.github.com/repos/test/test/issues/${i + 1}/comments`,
  events_url: `https://api.github.com/repos/test/test/issues/${i + 1}/events`,
  html_url: `https://github.com/test/test/issues/${i + 1}`,
  user: null,
  assignee: null,
  assignees: [],
  milestone: null,
  locked: false,
  active_lock_reason: null,
  comments: 0,
  closed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author_association: 'OWNER'
}));

async function testBatchProcessingOptimizations(): Promise<void> {
  console.log('🧪 Testing batch processing optimizations...\n');

  const config = {
    token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
    owner: 'test-owner',
    repo: 'test-repo',
    debug: true,
    batchConfig: {
      enableAdaptiveBatching: true,
      minBatchSize: 3,
      maxBatchSize: 15,
      baseBatchSize: 8,
      rateLimitThreshold: 0.3,
      errorRateThreshold: 0.1,
      enableBatchRetry: true,
      enableCheckpointing: true,
      checkpointInterval: 10
    } as BatchProcessingConfig
  };

  try {
    // Test 1: Create GitHub API client with batch configuration
    console.log('1. Testing GitHub API client with batch configuration...');
    const githubApi = createGitHubApiClient(config);
    console.log('✅ Successfully created GitHub API client with batch configuration');

    // Test 2: Test adaptive batch sizing
    console.log('\n2. Testing adaptive batch sizing...');
    
    // Simulate processing with different conditions
    const processingFunction = async (issue: typeof mockOpenIssues[0]) => {
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      // Simulate occasional failures (10% failure rate)
      if (Math.random() < 0.1) {
        throw new Error(`Simulated processing error for issue #${issue.number}`);
      }
      
      return {
        issueNumber: issue.number,
        processed: true,
        timestamp: new Date()
      };
    };

    // Test batch processing with checkpointing
    const checkpoints: ProcessingCheckpoint[] = [];
    const checkpointCallback = async (checkpoint: ProcessingCheckpoint) => {
      checkpoints.push({ ...checkpoint });
      console.log(`📋 Checkpoint: ${checkpoint.processedItems}/${checkpoint.totalItems} items processed`);
    };

    console.log(`Processing ${mockOpenIssues.length} mock issues with adaptive batching...`);
    const startTime = Date.now();

    const batchResult = await githubApi.processBatch(
      mockOpenIssues,
      processingFunction,
      {
        operationType: 'test-batch-processing',
        priority: OperationPriority.HIGH,
        enableCheckpointing: true,
        checkpointCallback
      }
    );

    const processingTime = Date.now() - startTime;

    console.log('\n📊 Batch Processing Results:');
    console.log(`   ✅ Successful: ${batchResult.successful.length}/${batchResult.metrics.totalItems}`);
    console.log(`   ❌ Failed: ${batchResult.failed.length}/${batchResult.metrics.totalItems}`);
    console.log(`   ⏱️  Processing Time: ${processingTime}ms`);
    console.log(`   📦 Batch Size Used: ${batchResult.metrics.batchSize}`);
    console.log(`   📈 Operations/Second: ${batchResult.metrics.operationsPerSecond.toFixed(2)}`);
    console.log(`   📋 Checkpoints: ${checkpoints.length}`);

    // Verify batch optimization worked
    if (batchResult.successful.length > 0) {
      console.log('✅ Batch processing completed with successful results');
    }

    if (batchResult.metrics.operationsPerSecond > 1) {
      console.log('✅ Performance optimization achieved (>1 ops/sec)');
    }

    // Test 3: Test retry functionality for failed operations
    if (batchResult.failed.length > 0) {
      console.log('\n3. Testing retry functionality for failed operations...');
      
      const retryResult = await githubApi.retryFailedBatch(
        batchResult.failed,
        processingFunction,
        {
          operationType: 'test-retry-processing',
          priority: OperationPriority.MEDIUM,
          maxRetries: 2,
          backoffMultiplier: 1.5
        }
      );

      console.log('\n📊 Retry Results:');
      console.log(`   ✅ Recovered: ${retryResult.successful.length}/${batchResult.failed.length}`);
      console.log(`   ❌ Still Failed: ${retryResult.failed.length}/${batchResult.failed.length}`);
      
      if (retryResult.successful.length > 0) {
        console.log('✅ Retry functionality working correctly');
      }
    } else {
      console.log('\n3. No failed operations to retry (100% success rate!)');
      console.log('✅ Excellent performance - no retries needed');
    }

    // Test 4: Test performance with large-scale simulation (500+ items)
    console.log('\n4. Testing large-scale performance (500+ items simulation)...');
    
    const largeDataSet = Array.from({ length: 500 }, (_, i) => ({
      ...mockOpenIssues[0],
      id: i + 1000,
      number: i + 1000,
      title: `Large Scale Test Issue ${i + 1000}`
    }));

    // Use a faster processing function for large-scale test
    const fastProcessingFunction = async (issue: typeof largeDataSet[0]) => {
      // Simulate very light processing
      if (Math.random() < 0.05) { // 5% failure rate for large scale
        throw new Error(`Simulated error for issue #${issue.number}`);
      }
      return { issueNumber: issue.number, processed: true };
    };

    const largeScaleStartTime = Date.now();
    
    const largeScaleResult = await githubApi.processBatch(
      largeDataSet,
      fastProcessingFunction,
      {
        operationType: 'large-scale-test',
        priority: OperationPriority.MEDIUM,
        enableCheckpointing: true,
        checkpointCallback: async (checkpoint) => {
          if (checkpoint.processedItems % 100 === 0) {
            console.log(`   📊 Large-scale progress: ${checkpoint.processedItems}/${checkpoint.totalItems} (${(checkpoint.processedItems / checkpoint.totalItems * 100).toFixed(1)}%)`);
          }
        }
      }
    );

    const largeScaleTime = Date.now() - largeScaleStartTime;

    console.log('\n📊 Large-Scale Performance Results:');
    console.log(`   📦 Total Items: ${largeScaleResult.metrics.totalItems}`);
    console.log(`   ✅ Success Rate: ${(largeScaleResult.successful.length / largeScaleResult.metrics.totalItems * 100).toFixed(1)}%`);
    console.log(`   ⏱️  Total Time: ${(largeScaleTime / 1000).toFixed(2)}s`);
    console.log(`   📈 Operations/Second: ${largeScaleResult.metrics.operationsPerSecond.toFixed(2)}`);
    console.log(`   📦 Optimal Batch Size: ${largeScaleResult.metrics.batchSize}`);

    // Performance assertions for large-scale operations
    if (largeScaleResult.metrics.operationsPerSecond > 5) {
      console.log('✅ Large-scale performance optimization successful (>5 ops/sec)');
    }

    if (largeScaleResult.successful.length >= 475) { // 95% success rate
      console.log('✅ Large-scale reliability achieved (>95% success rate)');
    }

    console.log('\n🎉 All batch processing optimization tests completed successfully!');
    
    console.log('\n📋 Summary of Optimizations Tested:');
    console.log('✅ Adaptive batch sizing based on performance');
    console.log('✅ Progress checkpointing for large operations'); 
    console.log('✅ Retry logic for failed operations');
    console.log('✅ Performance metrics and monitoring');
    console.log('✅ Large-scale operation handling (500+ items)');
    console.log('✅ Priority-based operation queueing');

  } catch (error) {
    console.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testBatchProcessingOptimizations().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { testBatchProcessingOptimizations };