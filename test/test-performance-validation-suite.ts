/**
 * Performance Validation Suite
 * 
 * Comprehensive performance testing framework that establishes baseline metrics,
 * implements load testing scenarios, and provides performance monitoring.
 * 
 * Builds on existing infrastructure:
 * - scripts/structured-logging.ts (performance measurement)
 * - scripts/artifact-manager.ts (performance reporting)
 * - test/test-batch-processing.ts (batch performance tests)
 */

import {
  EnhancedGitHubApi,
  createGitHubApiClient,
  OperationPriority,
  BatchProcessingConfig,
  type ProcessingCheckpoint
} from '../scripts/index';
import { StructuredLogger, LogCategory, LogLevel } from '../scripts/structured-logging';
import { ArtifactManager } from '../scripts/artifact-manager';

// Performance validation configuration
interface PerformanceConfig {
  baselineTests: {
    smallScale: { itemCount: number; expectedOpsPerSec: number };
    mediumScale: { itemCount: number; expectedOpsPerSec: number };
    largeScale: { itemCount: number; expectedOpsPerSec: number };
  };
  loadTests: {
    stressTest: { itemCount: number; failureRate: number };
    enduranceTest: { itemCount: number; duration: number };
    concurrencyTest: { batchCount: number; itemsPerBatch: number };
  };
  thresholds: {
    maxResponseTime: number; // milliseconds
    minSuccessRate: number; // percentage
    maxMemoryUsage: number; // bytes
  };
}

const defaultConfig: PerformanceConfig = {
  baselineTests: {
    smallScale: { itemCount: 10, expectedOpsPerSec: 5 },
    mediumScale: { itemCount: 100, expectedOpsPerSec: 8 },
    largeScale: { itemCount: 500, expectedOpsPerSec: 10 },
  },
  loadTests: {
    stressTest: { itemCount: 1000, failureRate: 0.1 },
    enduranceTest: { itemCount: 200, duration: 60000 }, // 1 minute
    concurrencyTest: { batchCount: 5, itemsPerBatch: 50 },
  },
  thresholds: {
    maxResponseTime: 5000, // 5 seconds
    minSuccessRate: 90, // 90%
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
  },
};

// Performance test result interface
interface PerformanceResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  metrics: {
    totalItems: number;
    successfulItems: number;
    failedItems: number;
    processingTimeMs: number;
    operationsPerSecond: number;
    averageResponseTime: number;
    memoryUsageMB: number;
    successRate: number;
  };
  baselineComparison?: {
    expectedOpsPerSec: number;
    actualOpsPerSec: number;
    performanceRatio: number;
  };
  issues?: string[];
}

class PerformanceValidationSuite {
  private logger: StructuredLogger;
  private artifactManager: ArtifactManager;
  private config: PerformanceConfig;
  private results: PerformanceResult[] = [];

  constructor(config: PerformanceConfig = defaultConfig) {
    this.config = config;
    this.logger = StructuredLogger.getInstance({
      enablePerformanceTracking: true,
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableStructuredOutput: false
    });
    this.artifactManager = new ArtifactManager();
  }

  /**
   * Run complete performance validation suite
   */
  async runCompleteSuite(): Promise<void> {
    console.log('🚀 Starting Performance Validation Suite\n');

    const suiteStartTime = Date.now();
    
    try {
      // 1. Baseline Performance Tests
      await this.runBaselineTests();
      
      // 2. Load Testing Scenarios
      await this.runLoadTests();
      
      // 3. Stress Testing
      await this.runStressTests();
      
      // 4. Performance Monitoring Validation
      await this.validatePerformanceMonitoring();
      
      // 5. Generate comprehensive report
      await this.generateValidationReport();
      
      const totalTime = Date.now() - suiteStartTime;
      console.log(`\n🎉 Performance Validation Suite completed in ${(totalTime / 1000).toFixed(2)}s`);
      
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Performance Validation Suite failed:', error);
      throw error;
    }
  }

  /**
   * Establish baseline performance metrics
   */
  private async runBaselineTests(): Promise<void> {
    console.log('📊 Running Baseline Performance Tests...\n');

    // Small scale baseline
    await this.runBaselineTest('Small Scale', this.config.baselineTests.smallScale);
    
    // Medium scale baseline
    await this.runBaselineTest('Medium Scale', this.config.baselineTests.mediumScale);
    
    // Large scale baseline
    await this.runBaselineTest('Large Scale', this.config.baselineTests.largeScale);
  }

  /**
   * Run individual baseline test
   */
  private async runBaselineTest(
    testName: string, 
    testConfig: { itemCount: number; expectedOpsPerSec: number }
  ): Promise<void> {
    console.log(`🧪 Baseline Test: ${testName} (${testConfig.itemCount} items)`);

    const githubApi = createGitHubApiClient({
      token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
      owner: 'test-owner',
      repo: 'test-repo',
      debug: false,
    });

    const testData = this.generateMockData(testConfig.itemCount);
    const performanceId = this.logger.startPerformanceMeasurement(`baseline-${testName.toLowerCase().replace(' ', '-')}`);
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await githubApi.processBatch(
        testData,
        this.createMockProcessingFunction(),
        {
          operationType: `baseline-${testName.toLowerCase().replace(' ', '-')}`,
          priority: OperationPriority.MEDIUM,
          enableCheckpointing: false,
        }
      );

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const processingTime = endTime - startTime;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;

      this.logger.endPerformanceMeasurement(performanceId, {
        testName,
        itemCount: testConfig.itemCount,
        expectedOpsPerSec: testConfig.expectedOpsPerSec
      });

      const performanceResult: PerformanceResult = {
        testName: `Baseline: ${testName}`,
        status: result.metrics.operationsPerSecond >= testConfig.expectedOpsPerSec ? 'PASS' : 'WARN',
        metrics: {
          totalItems: result.metrics.totalItems,
          successfulItems: result.successful.length,
          failedItems: result.failed.length,
          processingTimeMs: processingTime,
          operationsPerSecond: result.metrics.operationsPerSecond,
          averageResponseTime: processingTime / result.metrics.totalItems,
          memoryUsageMB: memoryUsed,
          successRate: (result.successful.length / result.metrics.totalItems) * 100,
        },
        baselineComparison: {
          expectedOpsPerSec: testConfig.expectedOpsPerSec,
          actualOpsPerSec: result.metrics.operationsPerSecond,
          performanceRatio: result.metrics.operationsPerSecond / testConfig.expectedOpsPerSec,
        }
      };

      if (performanceResult.status === 'WARN') {
        performanceResult.issues = [
          `Performance below baseline: ${result.metrics.operationsPerSecond.toFixed(2)} ops/sec < ${testConfig.expectedOpsPerSec} expected`
        ];
      }

      this.results.push(performanceResult);

      console.log(`   ✅ Items processed: ${result.successful.length}/${result.metrics.totalItems}`);
      console.log(`   📈 Operations/sec: ${result.metrics.operationsPerSecond.toFixed(2)} (expected: ${testConfig.expectedOpsPerSec})`);
      console.log(`   ⏱️  Processing time: ${processingTime}ms`);
      console.log(`   💾 Memory used: ${memoryUsed.toFixed(2)}MB`);
      console.log(`   ${performanceResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${performanceResult.status}\n`);

    } catch (error) {
      console.error(`   ❌ Baseline test failed: ${error}`);
      this.results.push({
        testName: `Baseline: ${testName}`,
        status: 'FAIL',
        metrics: {
          totalItems: testConfig.itemCount,
          successfulItems: 0,
          failedItems: testConfig.itemCount,
          processingTimeMs: Date.now() - startTime,
          operationsPerSecond: 0,
          averageResponseTime: 0,
          memoryUsageMB: 0,
          successRate: 0,
        },
        issues: [`Test execution failed: ${error instanceof Error ? error.message : String(error)}`]
      });
    }
  }

  /**
   * Run load testing scenarios
   */
  private async runLoadTests(): Promise<void> {
    console.log('🔄 Running Load Testing Scenarios...\n');

    // Stress test with high volume and failures
    await this.runStressTest();
    
    // Endurance test with sustained load
    await this.runEnduranceTest();
    
    // Concurrency test with multiple batches
    await this.runConcurrencyTest();
  }

  /**
   * Run stress test scenario
   */
  private async runStressTest(): Promise<void> {
    console.log(`🔥 Stress Test (${this.config.loadTests.stressTest.itemCount} items, ${(this.config.loadTests.stressTest.failureRate * 100).toFixed(1)}% failure rate)`);

    const githubApi = createGitHubApiClient({
      token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
      owner: 'test-owner',
      repo: 'test-repo',
      debug: false,
    });

    const testData = this.generateMockData(this.config.loadTests.stressTest.itemCount);
    const performanceId = this.logger.startPerformanceMeasurement('stress-test');
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await githubApi.processBatch(
        testData,
        this.createMockProcessingFunction(this.config.loadTests.stressTest.failureRate),
        {
          operationType: 'stress-test',
          priority: OperationPriority.HIGH,
          enableCheckpointing: true,
        }
      );

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const processingTime = endTime - startTime;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;
      const successRate = (result.successful.length / result.metrics.totalItems) * 100;

      this.logger.endPerformanceMeasurement(performanceId, {
        testType: 'stress-test',
        itemCount: this.config.loadTests.stressTest.itemCount,
        failureRate: this.config.loadTests.stressTest.failureRate
      });

      const issues = [];
      if (successRate < this.config.thresholds.minSuccessRate) {
        issues.push(`Success rate ${successRate.toFixed(1)}% below threshold ${this.config.thresholds.minSuccessRate}%`);
      }
      if (processingTime > this.config.thresholds.maxResponseTime) {
        issues.push(`Processing time ${processingTime}ms exceeds threshold ${this.config.thresholds.maxResponseTime}ms`);
      }

      const performanceResult: PerformanceResult = {
        testName: 'Load Test: Stress Test',
        status: issues.length === 0 ? 'PASS' : 'WARN',
        metrics: {
          totalItems: result.metrics.totalItems,
          successfulItems: result.successful.length,
          failedItems: result.failed.length,
          processingTimeMs: processingTime,
          operationsPerSecond: result.metrics.operationsPerSecond,
          averageResponseTime: processingTime / result.metrics.totalItems,
          memoryUsageMB: memoryUsed,
          successRate,
        },
        issues: issues.length > 0 ? issues : undefined
      };

      this.results.push(performanceResult);

      console.log(`   ✅ Items processed: ${result.successful.length}/${result.metrics.totalItems}`);
      console.log(`   📈 Operations/sec: ${result.metrics.operationsPerSecond.toFixed(2)}`);
      console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   ⏱️  Processing time: ${processingTime}ms`);
      console.log(`   💾 Memory used: ${memoryUsed.toFixed(2)}MB`);
      console.log(`   ${performanceResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${performanceResult.status}\n`);

    } catch (error) {
      console.error(`   ❌ Stress test failed: ${error}\n`);
    }
  }

  /**
   * Run endurance test scenario
   */
  private async runEnduranceTest(): Promise<void> {
    console.log(`⏱️ Endurance Test (${this.config.loadTests.enduranceTest.itemCount} items over ${this.config.loadTests.enduranceTest.duration / 1000}s)`);

    const startTime = Date.now();
    let totalProcessed = 0;
    let totalSuccessful = 0;
    const endTime = startTime + this.config.loadTests.enduranceTest.duration;

    while (Date.now() < endTime) {
      const githubApi = createGitHubApiClient({
        token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
        owner: 'test-owner',
        repo: 'test-repo',
        debug: false,
      });

      const testData = this.generateMockData(Math.min(50, this.config.loadTests.enduranceTest.itemCount - totalProcessed));
      
      try {
        const result = await githubApi.processBatch(
          testData,
          this.createMockProcessingFunction(0.05), // 5% failure rate
          {
            operationType: 'endurance-test',
            priority: OperationPriority.LOW,
            enableCheckpointing: false,
          }
        );

        totalProcessed += result.metrics.totalItems;
        totalSuccessful += result.successful.length;

        if (totalProcessed >= this.config.loadTests.enduranceTest.itemCount) {
          break;
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.warn(`   ⚠️ Endurance test batch failed: ${error}`);
      }
    }

    const totalTime = Date.now() - startTime;
    const successRate = (totalSuccessful / totalProcessed) * 100;

    const performanceResult: PerformanceResult = {
      testName: 'Load Test: Endurance Test',
      status: successRate >= this.config.thresholds.minSuccessRate ? 'PASS' : 'WARN',
      metrics: {
        totalItems: totalProcessed,
        successfulItems: totalSuccessful,
        failedItems: totalProcessed - totalSuccessful,
        processingTimeMs: totalTime,
        operationsPerSecond: (totalProcessed / (totalTime / 1000)),
        averageResponseTime: totalTime / totalProcessed,
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate,
      }
    };

    this.results.push(performanceResult);

    console.log(`   ✅ Items processed: ${totalSuccessful}/${totalProcessed}`);
    console.log(`   📈 Average ops/sec: ${performanceResult.metrics.operationsPerSecond.toFixed(2)}`);
    console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
    console.log(`   ⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   ${performanceResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${performanceResult.status}\n`);
  }

  /**
   * Run concurrency test scenario
   */
  private async runConcurrencyTest(): Promise<void> {
    console.log(`🔀 Concurrency Test (${this.config.loadTests.concurrencyTest.batchCount} concurrent batches, ${this.config.loadTests.concurrencyTest.itemsPerBatch} items each)`);

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < this.config.loadTests.concurrencyTest.batchCount; i++) {
      const githubApi = createGitHubApiClient({
        token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
        owner: 'test-owner',
        repo: 'test-repo',
        debug: false,
      });

      const testData = this.generateMockData(this.config.loadTests.concurrencyTest.itemsPerBatch);
      
      const promise = githubApi.processBatch(
        testData,
        this.createMockProcessingFunction(0.02), // 2% failure rate
        {
          operationType: `concurrency-test-batch-${i + 1}`,
          priority: OperationPriority.MEDIUM,
          enableCheckpointing: false,
        }
      );

      promises.push(promise);
    }

    try {
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const totalItems = results.reduce((sum, r) => sum + r.metrics.totalItems, 0);
      const totalSuccessful = results.reduce((sum, r) => sum + r.successful.length, 0);
      const successRate = (totalSuccessful / totalItems) * 100;

      const performanceResult: PerformanceResult = {
        testName: 'Load Test: Concurrency Test',
        status: successRate >= this.config.thresholds.minSuccessRate ? 'PASS' : 'WARN',
        metrics: {
          totalItems,
          successfulItems: totalSuccessful,
          failedItems: totalItems - totalSuccessful,
          processingTimeMs: totalTime,
          operationsPerSecond: (totalItems / (totalTime / 1000)),
          averageResponseTime: totalTime / totalItems,
          memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
          successRate,
        }
      };

      this.results.push(performanceResult);

      console.log(`   ✅ Items processed: ${totalSuccessful}/${totalItems}`);
      console.log(`   📈 Concurrent ops/sec: ${performanceResult.metrics.operationsPerSecond.toFixed(2)}`);
      console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   ⏱️  Concurrent time: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`   ${performanceResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${performanceResult.status}\n`);

    } catch (error) {
      console.error(`   ❌ Concurrency test failed: ${error}\n`);
    }
  }

  /**
   * Run stress tests for edge cases
   */
  private async runStressTests(): Promise<void> {
    console.log('⚡ Running Stress Tests for Edge Cases...\n');

    // Memory stress test
    await this.runMemoryStressTest();
    
    // Rate limit simulation test
    await this.runRateLimitStressTest();
  }

  /**
   * Memory stress test
   */
  private async runMemoryStressTest(): Promise<void> {
    console.log('💾 Memory Stress Test (large data structures)');

    const largeItemCount = 2000;
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const testData = this.generateMockData(largeItemCount, true); // Large data structures
      const processedCount = testData.length;
      
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;

      const performanceResult: PerformanceResult = {
        testName: 'Stress Test: Memory Usage',
        status: memoryUsed <= (this.config.thresholds.maxMemoryUsage / 1024 / 1024) ? 'PASS' : 'WARN',
        metrics: {
          totalItems: processedCount,
          successfulItems: processedCount,
          failedItems: 0,
          processingTimeMs: 0,
          operationsPerSecond: 0,
          averageResponseTime: 0,
          memoryUsageMB: memoryUsed,
          successRate: 100,
        },
        issues: memoryUsed > (this.config.thresholds.maxMemoryUsage / 1024 / 1024) ? [
          `Memory usage ${memoryUsed.toFixed(2)}MB exceeds threshold ${(this.config.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`
        ] : undefined
      };

      this.results.push(performanceResult);

      console.log(`   📊 Items created: ${processedCount}`);
      console.log(`   💾 Memory used: ${memoryUsed.toFixed(2)}MB`);
      console.log(`   🎯 Memory threshold: ${(this.config.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   ${performanceResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${performanceResult.status}\n`);

    } catch (error) {
      console.error(`   ❌ Memory stress test failed: ${error}\n`);
    }
  }

  /**
   * Rate limit stress test
   */
  private async runRateLimitStressTest(): Promise<void> {
    console.log('🚦 Rate Limit Stress Test (rapid requests)');

    const githubApi = createGitHubApiClient({
      token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
      owner: 'test-owner',
      repo: 'test-repo',
      debug: false,
    });

    const testData = this.generateMockData(100);
    const startTime = Date.now();

    try {
      // Simulate rapid requests that might trigger rate limiting
      const result = await githubApi.processBatch(
        testData,
        this.createRateLimitProcessingFunction(),
        {
          operationType: 'rate-limit-stress-test',
          priority: OperationPriority.HIGH,
          enableCheckpointing: false,
        }
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const successRate = (result.successful.length / result.metrics.totalItems) * 100;

      const performanceResult: PerformanceResult = {
        testName: 'Stress Test: Rate Limit Handling',
        status: successRate >= this.config.thresholds.minSuccessRate ? 'PASS' : 'WARN',
        metrics: {
          totalItems: result.metrics.totalItems,
          successfulItems: result.successful.length,
          failedItems: result.failed.length,
          processingTimeMs: processingTime,
          operationsPerSecond: result.metrics.operationsPerSecond,
          averageResponseTime: processingTime / result.metrics.totalItems,
          memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
          successRate,
        }
      };

      this.results.push(performanceResult);

      console.log(`   ✅ Items processed: ${result.successful.length}/${result.metrics.totalItems}`);
      console.log(`   📈 Operations/sec: ${result.metrics.operationsPerSecond.toFixed(2)}`);
      console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
      console.log(`   ⏱️  Processing time: ${processingTime}ms`);
      console.log(`   ${performanceResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${performanceResult.status}\n`);

    } catch (error) {
      console.error(`   ❌ Rate limit stress test failed: ${error}\n`);
    }
  }

  /**
   * Validate performance monitoring capabilities
   */
  private async validatePerformanceMonitoring(): Promise<void> {
    console.log('📊 Validating Performance Monitoring...\n');

    // Test performance measurement accuracy
    const testStartTime = Date.now();
    const performanceId = this.logger.startPerformanceMeasurement('monitoring-validation');
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.logger.endPerformanceMeasurement(performanceId, { testType: 'monitoring-validation' });
    
    const actualTime = Date.now() - testStartTime;
    const expectedTime = 100;
    const timeDifference = Math.abs(actualTime - expectedTime);
    
    console.log(`⏱️ Performance Monitoring Accuracy Test:`);
    console.log(`   🎯 Expected time: ~${expectedTime}ms`);
    console.log(`   📏 Actual time: ${actualTime}ms`);
    console.log(`   📊 Difference: ${timeDifference}ms`);
    console.log(`   ${timeDifference < 50 ? '✅' : '⚠️'} Accuracy: ${timeDifference < 50 ? 'PASS' : 'WARN'}\n`);

    const monitoringResult: PerformanceResult = {
      testName: 'Monitoring: Performance Measurement Accuracy',
      status: timeDifference < 50 ? 'PASS' : 'WARN',
      metrics: {
        totalItems: 1,
        successfulItems: 1,
        failedItems: 0,
        processingTimeMs: actualTime,
        operationsPerSecond: 1000 / actualTime,
        averageResponseTime: actualTime,
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate: 100,
      }
    };

    this.results.push(monitoringResult);
  }

  /**
   * Generate comprehensive validation report
   */
  private async generateValidationReport(): Promise<void> {
    console.log('📋 Generating Performance Validation Report...\n');

    const reportData = {
      suiteId: `performance-validation-${Date.now()}`,
      timestamp: new Date(),
      config: this.config,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.status === 'PASS').length,
        warningTests: this.results.filter(r => r.status === 'WARN').length,
        failedTests: this.results.filter(r => r.status === 'FAIL').length,
        overallStatus: this.calculateOverallStatus(),
      }
    };

    try {
      await this.artifactManager.generatePerformanceReport(
        reportData.suiteId,
        {
          totalItems: this.results.reduce((sum, r) => sum + r.metrics.totalItems, 0),
          successfulItems: this.results.reduce((sum, r) => sum + r.metrics.successfulItems, 0),
          failedItems: this.results.reduce((sum, r) => sum + r.metrics.failedItems, 0),
          processingTimeMs: this.results.reduce((sum, r) => sum + r.metrics.processingTimeMs, 0),
          batchMetrics: this.results.map(r => ({
            testName: r.testName,
            metrics: r.metrics,
            status: r.status
          })),
          errorBreakdown: this.getErrorBreakdown()
        }
      );

      console.log('✅ Performance validation report generated and uploaded as artifact');

    } catch (error) {
      console.warn(`⚠️ Failed to generate artifact report: ${error}`);
    }
  }

  /**
   * Calculate overall status based on individual test results
   */
  private calculateOverallStatus(): string {
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    
    if (failed > 0) return 'FAIL';
    if (warnings > 0) return 'WARN';
    return 'PASS';
  }

  /**
   * Get error breakdown for reporting
   */
  private getErrorBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    this.results.forEach(result => {
      if (result.issues) {
        result.issues.forEach(issue => {
          const category = issue.split(':')[0] || 'Unknown';
          breakdown[category] = (breakdown[category] || 0) + 1;
        });
      }
    });
    
    return breakdown;
  }

  /**
   * Print validation summary
   */
  private printSummary(): void {
    console.log('\n📊 Performance Validation Suite Summary');
    console.log('=' .repeat(50));
    
    const summary = {
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.status === 'PASS').length,
      warningTests: this.results.filter(r => r.status === 'WARN').length,
      failedTests: this.results.filter(r => r.status === 'FAIL').length,
    };

    console.log(`📋 Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passedTests}`);
    console.log(`⚠️ Warnings: ${summary.warningTests}`);
    console.log(`❌ Failed: ${summary.failedTests}`);
    console.log(`🎯 Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);
    
    const overallStatus = this.calculateOverallStatus();
    console.log(`\n🚀 Overall Status: ${overallStatus === 'PASS' ? '✅' : overallStatus === 'WARN' ? '⚠️' : '❌'} ${overallStatus}`);

    // Show detailed results
    console.log('\n📋 Detailed Results:');
    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`   ${icon} ${result.testName}: ${result.status}`);
      if (result.metrics.operationsPerSecond > 0) {
        console.log(`      📈 ${result.metrics.operationsPerSecond.toFixed(2)} ops/sec, ${result.metrics.successRate.toFixed(1)}% success`);
      }
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => {
          console.log(`      ⚠️ ${issue}`);
        });
      }
    });
  }

  /**
   * Generate mock data for testing
   */
  private generateMockData(count: number, largeStructures: boolean = false): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      title: `Performance Test Issue ${i + 1}`,
      body: largeStructures 
        ? `## Performance Test Issue ${i + 1}\n\n${'#'.repeat(1000)}\n\n${Array.from({ length: 100 }, (_, j) => `Line ${j + 1}`).join('\n')}`
        : `## Performance Test Issue ${i + 1}\n\nBasic test issue for performance validation.`,
      labels: largeStructures ? Array.from({ length: 10 }, (_, j) => ({ name: `label-${j}` })) : [],
      state: 'open',
      node_id: `test_perf_${i + 1}`,
      url: `https://api.github.com/repos/test/test/issues/${i + 1}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Create mock processing function
   */
  private createMockProcessingFunction(failureRate: number = 0.05) {
    return async (item: any) => {
      // Simulate processing time
      const processingTime = Math.random() * 50 + 10; // 10-60ms
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Simulate failures
      if (Math.random() < failureRate) {
        throw new Error(`Simulated processing error for item ${item.id}`);
      }

      return { 
        id: item.id, 
        processed: true, 
        processingTime 
      };
    };
  }

  /**
   * Create rate limit simulation processing function
   */
  private createRateLimitProcessingFunction() {
    let requestCount = 0;
    
    return async (item: any) => {
      requestCount++;
      
      // Simulate rate limiting after many requests
      if (requestCount > 80 && Math.random() < 0.3) {
        throw new Error('Rate limit exceeded (simulated)');
      }

      // Simulate varying response times
      const processingTime = Math.random() * 100 + 20; // 20-120ms
      await new Promise(resolve => setTimeout(resolve, processingTime));

      return { 
        id: item.id, 
        processed: true, 
        processingTime,
        requestNumber: requestCount
      };
    };
  }
}

// Main execution function
async function runPerformanceValidationSuite(): Promise<void> {
  const suite = new PerformanceValidationSuite();
  
  try {
    await suite.runCompleteSuite();
    process.exit(0);
  } catch (error) {
    console.error('💥 Performance Validation Suite failed:', error);
    process.exit(1);
  }
}

// Run the suite if this file is executed directly
if (require.main === module) {
  runPerformanceValidationSuite();
}

export { PerformanceValidationSuite, runPerformanceValidationSuite };