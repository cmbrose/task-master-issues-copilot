/**
 * Load Testing Scenarios
 * 
 * Specialized load testing configurations and scenarios for different
 * operational patterns and system stress conditions.
 */

import {
  EnhancedGitHubApi,
  createGitHubApiClient,
  OperationPriority,
} from '../scripts/index';

/**
 * Load testing configuration profiles
 */
export interface LoadTestProfile {
  name: string;
  description: string;
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  description: string;
  config: {
    itemCount: number;
    concurrency: number;
    duration?: number; // milliseconds
    failureRate: number;
    batchSize?: number;
    rampUpTime?: number; // milliseconds
  };
  expectedMetrics: {
    minOpsPerSec: number;
    maxOpsPerSec: number;
    minSuccessRate: number;
    maxResponseTime: number;
  };
}

/**
 * Predefined load testing profiles for different operational scenarios
 */
export const LOAD_TEST_PROFILES: LoadTestProfile[] = [
  {
    name: 'Development Workflow',
    description: 'Typical development team workflow patterns',
    scenarios: [
      {
        name: 'Small PR Processing',
        description: 'Processing small PRs with 5-15 tasks',
        config: {
          itemCount: 10,
          concurrency: 1,
          failureRate: 0.02,
          batchSize: 5,
        },
        expectedMetrics: {
          minOpsPerSec: 8,
          maxOpsPerSec: 15,
          minSuccessRate: 95,
          maxResponseTime: 2000,
        },
      },
      {
        name: 'Medium Feature Development',
        description: 'Medium-sized features with 20-50 tasks',
        config: {
          itemCount: 35,
          concurrency: 2,
          failureRate: 0.05,
          batchSize: 10,
        },
        expectedMetrics: {
          minOpsPerSec: 10,
          maxOpsPerSec: 20,
          minSuccessRate: 92,
          maxResponseTime: 4000,
        },
      },
      {
        name: 'Large Epic Planning',
        description: 'Large epics with 50-150 tasks',
        config: {
          itemCount: 100,
          concurrency: 3,
          failureRate: 0.08,
          batchSize: 15,
        },
        expectedMetrics: {
          minOpsPerSec: 12,
          maxOpsPerSec: 25,
          minSuccessRate: 90,
          maxResponseTime: 8000,
        },
      },
    ],
  },
  {
    name: 'Enterprise Scale',
    description: 'Large-scale enterprise deployment patterns',
    scenarios: [
      {
        name: 'Major Release Planning',
        description: 'Large releases with 200-500 tasks',
        config: {
          itemCount: 350,
          concurrency: 5,
          failureRate: 0.1,
          batchSize: 25,
          rampUpTime: 5000,
        },
        expectedMetrics: {
          minOpsPerSec: 15,
          maxOpsPerSec: 30,
          minSuccessRate: 88,
          maxResponseTime: 15000,
        },
      },
      {
        name: 'Quarterly Planning',
        description: 'Quarterly planning with 500+ tasks',
        config: {
          itemCount: 750,
          concurrency: 8,
          failureRate: 0.12,
          batchSize: 30,
          rampUpTime: 10000,
        },
        expectedMetrics: {
          minOpsPerSec: 18,
          maxOpsPerSec: 35,
          minSuccessRate: 85,
          maxResponseTime: 25000,
        },
      },
      {
        name: 'Organization-wide Initiative',
        description: 'Organization-wide initiatives with 1000+ tasks',
        config: {
          itemCount: 1200,
          concurrency: 10,
          failureRate: 0.15,
          batchSize: 40,
          rampUpTime: 15000,
        },
        expectedMetrics: {
          minOpsPerSec: 20,
          maxOpsPerSec: 40,
          minSuccessRate: 82,
          maxResponseTime: 40000,
        },
      },
    ],
  },
  {
    name: 'Stress Testing',
    description: 'Stress testing scenarios for system limits',
    scenarios: [
      {
        name: 'API Rate Limit Stress',
        description: 'Test behavior near API rate limits',
        config: {
          itemCount: 500,
          concurrency: 15,
          failureRate: 0.2,
          batchSize: 50,
        },
        expectedMetrics: {
          minOpsPerSec: 5,
          maxOpsPerSec: 25,
          minSuccessRate: 75,
          maxResponseTime: 30000,
        },
      },
      {
        name: 'High Failure Rate Recovery',
        description: 'Test recovery under high failure conditions',
        config: {
          itemCount: 200,
          concurrency: 5,
          failureRate: 0.4,
          batchSize: 20,
        },
        expectedMetrics: {
          minOpsPerSec: 3,
          maxOpsPerSec: 15,
          minSuccessRate: 60,
          maxResponseTime: 20000,
        },
      },
      {
        name: 'Memory Pressure Test',
        description: 'Test with large data structures and memory pressure',
        config: {
          itemCount: 100,
          concurrency: 2,
          failureRate: 0.1,
          batchSize: 10,
        },
        expectedMetrics: {
          minOpsPerSec: 2,
          maxOpsPerSec: 10,
          minSuccessRate: 85,
          maxResponseTime: 15000,
        },
      },
    ],
  },
];

/**
 * Load test execution result
 */
export interface LoadTestResult {
  profile: string;
  scenario: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  metrics: {
    actualOpsPerSec: number;
    actualSuccessRate: number;
    actualResponseTime: number;
    totalItems: number;
    successfulItems: number;
    failedItems: number;
    processingTimeMs: number;
    memoryUsageMB: number;
    concurrentBatches: number;
  };
  expectedMetrics: LoadTestScenario['expectedMetrics'];
  issues: string[];
  recommendations: string[];
}

/**
 * Load Test Executor
 */
export class LoadTestExecutor {
  private githubApi: EnhancedGitHubApi;

  constructor(apiConfig: any) {
    this.githubApi = createGitHubApiClient(apiConfig);
  }

  /**
   * Run a complete load testing profile
   */
  async runProfile(profile: LoadTestProfile): Promise<LoadTestResult[]> {
    console.log(`🚀 Running Load Test Profile: ${profile.name}`);
    console.log(`📄 ${profile.description}\n`);

    const results: LoadTestResult[] = [];

    for (const scenario of profile.scenarios) {
      const result = await this.runScenario(profile.name, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run a single load testing scenario
   */
  async runScenario(profileName: string, scenario: LoadTestScenario): Promise<LoadTestResult> {
    console.log(`🧪 Running Scenario: ${scenario.name}`);
    console.log(`   📝 ${scenario.description}`);
    console.log(`   📊 Items: ${scenario.config.itemCount}, Concurrency: ${scenario.config.concurrency}, Failure Rate: ${(scenario.config.failureRate * 100).toFixed(1)}%`);

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      let result;

      if (scenario.config.concurrency > 1) {
        result = await this.runConcurrentScenario(scenario);
      } else {
        result = await this.runSequentialScenario(scenario);
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;

      const actualOpsPerSec = result.totalItems / (totalTime / 1000);
      const actualSuccessRate = (result.successfulItems / result.totalItems) * 100;
      const actualResponseTime = totalTime;

      // Evaluate against expected metrics
      const issues: string[] = [];
      if (actualOpsPerSec < scenario.expectedMetrics.minOpsPerSec) {
        issues.push(`Operations per second ${actualOpsPerSec.toFixed(2)} below minimum ${scenario.expectedMetrics.minOpsPerSec}`);
      }
      if (actualOpsPerSec > scenario.expectedMetrics.maxOpsPerSec) {
        issues.push(`Operations per second ${actualOpsPerSec.toFixed(2)} exceeds maximum ${scenario.expectedMetrics.maxOpsPerSec} (may indicate insufficient load)`);
      }
      if (actualSuccessRate < scenario.expectedMetrics.minSuccessRate) {
        issues.push(`Success rate ${actualSuccessRate.toFixed(1)}% below minimum ${scenario.expectedMetrics.minSuccessRate}%`);
      }
      if (actualResponseTime > scenario.expectedMetrics.maxResponseTime) {
        issues.push(`Response time ${actualResponseTime}ms exceeds maximum ${scenario.expectedMetrics.maxResponseTime}ms`);
      }

      const recommendations = this.generateRecommendations(scenario, {
        actualOpsPerSec,
        actualSuccessRate,
        actualResponseTime,
        memoryUsed
      });

      const status = issues.length === 0 ? 'PASS' : 
                    issues.some(issue => issue.includes('below minimum') || issue.includes('exceeds maximum')) ? 'FAIL' : 'WARN';

      const loadTestResult: LoadTestResult = {
        profile: profileName,
        scenario: scenario.name,
        status,
        metrics: {
          actualOpsPerSec,
          actualSuccessRate,
          actualResponseTime,
          totalItems: result.totalItems,
          successfulItems: result.successfulItems,
          failedItems: result.failedItems,
          processingTimeMs: totalTime,
          memoryUsageMB: memoryUsed,
          concurrentBatches: scenario.config.concurrency,
        },
        expectedMetrics: scenario.expectedMetrics,
        issues,
        recommendations,
      };

      this.printScenarioResult(loadTestResult);
      return loadTestResult;

    } catch (error) {
      console.error(`   ❌ Scenario failed: ${error}\n`);
      
      return {
        profile: profileName,
        scenario: scenario.name,
        status: 'FAIL',
        metrics: {
          actualOpsPerSec: 0,
          actualSuccessRate: 0,
          actualResponseTime: Date.now() - startTime,
          totalItems: scenario.config.itemCount,
          successfulItems: 0,
          failedItems: scenario.config.itemCount,
          processingTimeMs: Date.now() - startTime,
          memoryUsageMB: 0,
          concurrentBatches: scenario.config.concurrency,
        },
        expectedMetrics: scenario.expectedMetrics,
        issues: [`Execution failed: ${error instanceof Error ? error.message : String(error)}`],
        recommendations: ['Review logs and system resources', 'Check API connectivity and permissions'],
      };
    }
  }

  /**
   * Run scenario with sequential processing
   */
  private async runSequentialScenario(scenario: LoadTestScenario): Promise<any> {
    const testData = this.generateLoadTestData(scenario.config.itemCount);
    
    const result = await this.githubApi.processBatch(
      testData,
      this.createLoadTestProcessingFunction(scenario.config.failureRate),
      {
        operationType: `load-test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`,
        priority: OperationPriority.MEDIUM,
        enableCheckpointing: true,
      }
    );

    return {
      totalItems: result.metrics.totalItems,
      successfulItems: result.successful.length,
      failedItems: result.failed.length,
    };
  }

  /**
   * Run scenario with concurrent processing
   */
  private async runConcurrentScenario(scenario: LoadTestScenario): Promise<any> {
    const itemsPerBatch = Math.ceil(scenario.config.itemCount / scenario.config.concurrency);
    const promises: Promise<any>[] = [];

    // Implement ramp-up if specified
    const rampUpDelay = scenario.config.rampUpTime 
      ? scenario.config.rampUpTime / scenario.config.concurrency 
      : 0;

    for (let i = 0; i < scenario.config.concurrency; i++) {
      const actualItemCount = Math.min(itemsPerBatch, scenario.config.itemCount - (i * itemsPerBatch));
      if (actualItemCount <= 0) break;

      const testData = this.generateLoadTestData(actualItemCount);
      
      const promise = (async () => {
        // Ramp-up delay
        if (rampUpDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, i * rampUpDelay));
        }

        return await this.githubApi.processBatch(
          testData,
          this.createLoadTestProcessingFunction(scenario.config.failureRate),
          {
            operationType: `load-test-concurrent-${scenario.name.toLowerCase().replace(/\s+/g, '-')}-batch-${i + 1}`,
            priority: OperationPriority.MEDIUM,
            enableCheckpointing: false,
          }
        );
      })();

      promises.push(promise);
    }

    const results = await Promise.all(promises);

    return {
      totalItems: results.reduce((sum, r) => sum + r.metrics.totalItems, 0),
      successfulItems: results.reduce((sum, r) => sum + r.successful.length, 0),
      failedItems: results.reduce((sum, r) => sum + r.failed.length, 0),
    };
  }

  /**
   * Generate test data for load testing
   */
  private generateLoadTestData(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      number: i + 1,
      title: `Load Test Issue ${i + 1}`,
      body: `## Load Test Issue ${i + 1}\n\nGenerated for load testing scenario.`,
      labels: [],
      state: 'open',
      node_id: `load_test_${i + 1}`,
      url: `https://api.github.com/repos/test/test/issues/${i + 1}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Create processing function for load testing
   */
  private createLoadTestProcessingFunction(failureRate: number) {
    return async (item: any) => {
      // Simulate variable processing time
      const baseTime = 20;
      const variableTime = Math.random() * 100; // 0-100ms variation
      const processingTime = baseTime + variableTime;
      
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Simulate failures based on specified rate
      if (Math.random() < failureRate) {
        throw new Error(`Load test simulated failure for item ${item.id}`);
      }

      return { 
        id: item.id, 
        processed: true, 
        processingTime,
        timestamp: new Date().toISOString()
      };
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(scenario: LoadTestScenario, actualMetrics: any): string[] {
    const recommendations: string[] = [];

    if (actualMetrics.actualOpsPerSec < scenario.expectedMetrics.minOpsPerSec) {
      recommendations.push('Consider increasing batch size for better throughput');
      recommendations.push('Review rate limiting and backoff strategies');
      recommendations.push('Check for network latency issues');
    }

    if (actualMetrics.actualSuccessRate < scenario.expectedMetrics.minSuccessRate) {
      recommendations.push('Improve error handling and retry mechanisms');
      recommendations.push('Investigate root causes of failures');
      recommendations.push('Consider implementing circuit breaker patterns');
    }

    if (actualMetrics.actualResponseTime > scenario.expectedMetrics.maxResponseTime) {
      recommendations.push('Optimize processing logic for better response times');
      recommendations.push('Consider implementing request queuing');
      recommendations.push('Review timeout configurations');
    }

    if (actualMetrics.memoryUsed > 100) { // > 100MB
      recommendations.push('Monitor memory usage and implement garbage collection');
      recommendations.push('Consider streaming or chunked processing for large datasets');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance meets expectations - consider increasing load for stress testing');
      recommendations.push('Monitor for performance regression in future tests');
    }

    return recommendations;
  }

  /**
   * Print scenario result
   */
  private printScenarioResult(result: LoadTestResult): void {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    
    console.log(`   ${statusIcon} Status: ${result.status}`);
    console.log(`   📈 Operations/sec: ${result.metrics.actualOpsPerSec.toFixed(2)} (expected: ${result.expectedMetrics.minOpsPerSec}-${result.expectedMetrics.maxOpsPerSec})`);
    console.log(`   📊 Success rate: ${result.metrics.actualSuccessRate.toFixed(1)}% (min: ${result.expectedMetrics.minSuccessRate}%)`);
    console.log(`   ⏱️  Response time: ${result.metrics.actualResponseTime}ms (max: ${result.expectedMetrics.maxResponseTime}ms)`);
    console.log(`   💾 Memory used: ${result.metrics.memoryUsageMB.toFixed(2)}MB`);
    console.log(`   📦 Processed: ${result.metrics.successfulItems}/${result.metrics.totalItems}`);

    if (result.issues.length > 0) {
      console.log(`   ⚠️ Issues:`);
      result.issues.forEach(issue => console.log(`      • ${issue}`));
    }

    if (result.recommendations.length > 0) {
      console.log(`   💡 Recommendations:`);
      result.recommendations.slice(0, 2).forEach(rec => console.log(`      • ${rec}`));
    }

    console.log();
  }
}

// Utility function to run all load test profiles
export async function runAllLoadTestProfiles(): Promise<LoadTestResult[]> {
  const executor = new LoadTestExecutor({
    token: process.env.GITHUB_TOKEN || 'fake-token-for-testing',
    owner: 'test-owner',
    repo: 'test-repo',
    debug: false,
  });

  const allResults: LoadTestResult[] = [];

  for (const profile of LOAD_TEST_PROFILES) {
    const profileResults = await executor.runProfile(profile);
    allResults.push(...profileResults);
  }

  return allResults;
}

// Main execution function for running load tests
async function runLoadTests(): Promise<void> {
  console.log('🚀 Starting Load Testing Scenarios\n');

  try {
    const results = await runAllLoadTestProfiles();

    // Print summary
    console.log('\n📊 Load Testing Summary');
    console.log('=' .repeat(50));
    
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      warnings: results.filter(r => r.status === 'WARN').length,
      failed: results.filter(r => r.status === 'FAIL').length,
    };

    console.log(`📋 Total Scenarios: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`⚠️ Warnings: ${summary.warnings}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`🎯 Success Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);

    const overallStatus = summary.failed > 0 ? 'FAIL' : summary.warnings > 0 ? 'WARN' : 'PASS';
    console.log(`\n🚀 Overall Status: ${overallStatus === 'PASS' ? '✅' : overallStatus === 'WARN' ? '⚠️' : '❌'} ${overallStatus}`);

    process.exit(summary.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Load testing failed:', error);
    process.exit(1);
  }
}

// Run load tests if this file is executed directly
if (require.main === module) {
  runLoadTests();
}

// Run load tests if this file is executed directly
if (require.main === module) {
  runLoadTests();
}