/**
 * Performance Benchmarking and Monitoring
 * 
 * Provides baseline performance metrics, regression testing, and monitoring
 * capabilities for the task management system.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StructuredLogger, LogCategory, LogLevel } from '../scripts/structured-logging';

/**
 * Performance benchmark data structure
 */
export interface PerformanceBenchmarkData {
  testName: string;
  timestamp: Date;
  version: string;
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    memory: number;
  };
  metrics: {
    operationsPerSecond: number;
    averageResponseTime: number;
    memoryUsageMB: number;
    successRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
  };
  metadata: {
    itemCount: number;
    concurrency: number;
    testDuration: number;
    configuration: Record<string, any>;
  };
}

/**
 * Performance regression analysis result
 */
export interface RegressionAnalysis {
  testName: string;
  status: 'IMPROVED' | 'STABLE' | 'DEGRADED' | 'CRITICAL';
  changes: {
    operationsPerSecond: { current: number; baseline: number; change: number; changePercent: number };
    averageResponseTime: { current: number; baseline: number; change: number; changePercent: number };
    memoryUsage: { current: number; baseline: number; change: number; changePercent: number };
    successRate: { current: number; baseline: number; change: number; changePercent: number };
  };
  recommendations: string[];
  alerts: string[];
}

/**
 * Performance thresholds for monitoring
 */
export interface PerformanceThresholds {
  operationsPerSecond: { min: number; target: number; max: number };
  responseTime: { max: number; p95Max: number; p99Max: number };
  memoryUsage: { maxMB: number; warningMB: number };
  successRate: { min: number; target: number };
  degradationThresholds: {
    critical: number; // % degradation that triggers critical alert
    warning: number;  // % degradation that triggers warning
  };
}

/**
 * Default performance thresholds
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  operationsPerSecond: { min: 5, target: 15, max: 50 },
  responseTime: { max: 5000, p95Max: 3000, p99Max: 8000 },
  memoryUsage: { maxMB: 500, warningMB: 300 },
  successRate: { min: 90, target: 98 },
  degradationThresholds: { critical: 25, warning: 10 },
};

/**
 * Performance monitoring and benchmarking class
 */
export class PerformanceBenchmark {
  private logger: StructuredLogger;
  private benchmarkDir: string;
  private thresholds: PerformanceThresholds;

  constructor(benchmarkDir: string = './performance-benchmarks', thresholds?: PerformanceThresholds) {
    this.benchmarkDir = benchmarkDir;
    this.thresholds = thresholds || DEFAULT_THRESHOLDS;
    this.logger = StructuredLogger.getInstance({
      enablePerformanceTracking: true,
      minLevel: LogLevel.INFO,
      enableConsole: true,
      enableStructuredOutput: false
    });

    // Ensure benchmark directory exists
    if (!fs.existsSync(this.benchmarkDir)) {
      fs.mkdirSync(this.benchmarkDir, { recursive: true });
    }
  }

  /**
   * Record a new performance benchmark
   */
  async recordBenchmark(
    testName: string,
    metrics: PerformanceBenchmarkData['metrics'],
    metadata: PerformanceBenchmarkData['metadata'],
    version: string = '1.0.0'
  ): Promise<void> {
    const benchmark: PerformanceBenchmarkData = {
      testName,
      timestamp: new Date(),
      version,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: process.memoryUsage().heapTotal / 1024 / 1024,
      },
      metrics,
      metadata,
    };

    const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
    const filepath = path.join(this.benchmarkDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(benchmark, null, 2));

    this.logger.info(
      `Performance benchmark recorded: ${testName}`,
      LogCategory.PERFORMANCE,
      {
        benchmark: {
          testName,
          operationsPerSecond: metrics.operationsPerSecond,
          responseTime: metrics.averageResponseTime,
          successRate: metrics.successRate,
        }
      }
    );

    console.log(`📊 Benchmark recorded: ${testName}`);
    console.log(`   📁 File: ${filename}`);
    console.log(`   📈 Ops/sec: ${metrics.operationsPerSecond.toFixed(2)}`);
    console.log(`   ⏱️  Avg response: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   📊 Success rate: ${metrics.successRate.toFixed(1)}%`);
  }

  /**
   * Load benchmarks for a specific test
   */
  loadBenchmarks(testName: string): PerformanceBenchmarkData[] {
    const pattern = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_`;
    const files = fs.readdirSync(this.benchmarkDir)
      .filter(file => file.startsWith(pattern) && file.endsWith('.json'))
      .sort();

    return files.map(file => {
      const content = fs.readFileSync(path.join(this.benchmarkDir, file), 'utf8');
      return JSON.parse(content) as PerformanceBenchmarkData;
    });
  }

  /**
   * Get baseline benchmark (most recent stable benchmark)
   */
  getBaselineBenchmark(testName: string): PerformanceBenchmarkData | null {
    const benchmarks = this.loadBenchmarks(testName);
    
    if (benchmarks.length === 0) {
      return null;
    }

    // Return the most recent benchmark that meets minimum success rate
    return benchmarks
      .filter(b => b.metrics.successRate >= this.thresholds.successRate.min)
      .pop() || benchmarks[benchmarks.length - 1];
  }

  /**
   * Analyze performance regression
   */
  analyzeRegression(testName: string, currentMetrics: PerformanceBenchmarkData['metrics']): RegressionAnalysis | null {
    const baseline = this.getBaselineBenchmark(testName);
    
    if (!baseline) {
      console.log(`⚠️ No baseline found for ${testName} - skipping regression analysis`);
      return null;
    }

    const changes = {
      operationsPerSecond: this.calculateChange(currentMetrics.operationsPerSecond, baseline.metrics.operationsPerSecond),
      averageResponseTime: this.calculateChange(currentMetrics.averageResponseTime, baseline.metrics.averageResponseTime),
      memoryUsage: this.calculateChange(currentMetrics.memoryUsageMB, baseline.metrics.memoryUsageMB),
      successRate: this.calculateChange(currentMetrics.successRate, baseline.metrics.successRate),
    };

    // Determine overall status
    const status = this.determineRegressionStatus(changes);
    
    // Generate recommendations and alerts
    const recommendations = this.generateRecommendations(changes, status);
    const alerts = this.generateAlerts(changes, status);

    const analysis: RegressionAnalysis = {
      testName,
      status,
      changes,
      recommendations,
      alerts,
    };

    this.logRegressionAnalysis(analysis);
    
    return analysis;
  }

  /**
   * Calculate percentage change between current and baseline
   */
  private calculateChange(current: number, baseline: number) {
    const change = current - baseline;
    const changePercent = baseline !== 0 ? (change / baseline) * 100 : 0;
    
    return {
      current,
      baseline,
      change,
      changePercent,
    };
  }

  /**
   * Determine regression status based on changes
   */
  private determineRegressionStatus(changes: RegressionAnalysis['changes']): RegressionAnalysis['status'] {
    // Check for critical degradation
    const criticalThreshold = this.thresholds.degradationThresholds.critical;
    const warningThreshold = this.thresholds.degradationThresholds.warning;

    // Operations per second decrease is bad
    if (changes.operationsPerSecond.changePercent < -criticalThreshold) {
      return 'CRITICAL';
    }

    // Response time increase is bad
    if (changes.averageResponseTime.changePercent > criticalThreshold) {
      return 'CRITICAL';
    }

    // Success rate decrease is bad
    if (changes.successRate.changePercent < -criticalThreshold) {
      return 'CRITICAL';
    }

    // Check for warning-level degradation
    if (changes.operationsPerSecond.changePercent < -warningThreshold ||
        changes.averageResponseTime.changePercent > warningThreshold ||
        changes.successRate.changePercent < -warningThreshold) {
      return 'DEGRADED';
    }

    // Check for improvement
    if (changes.operationsPerSecond.changePercent > warningThreshold ||
        changes.averageResponseTime.changePercent < -warningThreshold ||
        changes.successRate.changePercent > 5) {
      return 'IMPROVED';
    }

    return 'STABLE';
  }

  /**
   * Generate recommendations based on performance changes
   */
  private generateRecommendations(changes: RegressionAnalysis['changes'], status: RegressionAnalysis['status']): string[] {
    const recommendations: string[] = [];

    if (status === 'CRITICAL' || status === 'DEGRADED') {
      if (changes.operationsPerSecond.changePercent < -10) {
        recommendations.push('Investigate throughput degradation - check for bottlenecks in processing pipeline');
        recommendations.push('Review recent changes that might impact batch processing efficiency');
      }

      if (changes.averageResponseTime.changePercent > 20) {
        recommendations.push('Response time has increased significantly - check for network latency or API delays');
        recommendations.push('Consider optimizing processing algorithms or reducing batch sizes');
      }

      if (changes.successRate.changePercent < -5) {
        recommendations.push('Success rate has declined - investigate error patterns and retry mechanisms');
        recommendations.push('Check API rate limiting and error handling strategies');
      }

      if (changes.memoryUsage.changePercent > 30) {
        recommendations.push('Memory usage has increased - check for memory leaks or inefficient data structures');
        recommendations.push('Consider implementing garbage collection optimization');
      }
    }

    if (status === 'IMPROVED') {
      recommendations.push('Performance has improved - consider documenting optimizations for future reference');
      recommendations.push('Update performance baselines to reflect improvements');
    }

    if (status === 'STABLE') {
      recommendations.push('Performance is stable - continue monitoring for trends');
    }

    return recommendations;
  }

  /**
   * Generate alerts based on performance changes
   */
  private generateAlerts(changes: RegressionAnalysis['changes'], status: RegressionAnalysis['status']): string[] {
    const alerts: string[] = [];

    if (status === 'CRITICAL') {
      alerts.push('🚨 CRITICAL: Performance degradation detected - immediate investigation required');
      
      if (changes.operationsPerSecond.changePercent < -25) {
        alerts.push(`🚨 Throughput dropped by ${Math.abs(changes.operationsPerSecond.changePercent).toFixed(1)}%`);
      }
      
      if (changes.averageResponseTime.changePercent > 50) {
        alerts.push(`🚨 Response time increased by ${changes.averageResponseTime.changePercent.toFixed(1)}%`);
      }
      
      if (changes.successRate.changePercent < -10) {
        alerts.push(`🚨 Success rate dropped by ${Math.abs(changes.successRate.changePercent).toFixed(1)}%`);
      }
    }

    if (status === 'DEGRADED') {
      alerts.push('⚠️ WARNING: Performance degradation detected');
    }

    if (status === 'IMPROVED') {
      alerts.push('✅ GOOD: Performance improvement detected');
    }

    return alerts;
  }

  /**
   * Log regression analysis
   */
  private logRegressionAnalysis(analysis: RegressionAnalysis): void {
    this.logger.info(
      `Performance regression analysis: ${analysis.testName}`,
      LogCategory.PERFORMANCE,
      {
        regressionAnalysis: {
          testName: analysis.testName,
          status: analysis.status,
          changes: analysis.changes,
          alertCount: analysis.alerts.length,
          recommendationCount: analysis.recommendations.length,
        }
      }
    );
  }

  /**
   * Generate performance monitoring report
   */
  generateMonitoringReport(testResults: Array<{ testName: string; metrics: PerformanceBenchmarkData['metrics'] }>): string {
    const report = ['# Performance Monitoring Report', ''];
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Overall summary
    const overallStatus = this.calculateOverallStatus(testResults);
    report.push(`## Overall Status: ${overallStatus}`);
    report.push('');

    // Individual test results
    report.push('## Test Results');
    report.push('');

    testResults.forEach(result => {
      const regression = this.analyzeRegression(result.testName, result.metrics);
      
      report.push(`### ${result.testName}`);
      if (regression) {
        report.push(`- **Status**: ${regression.status}`);
        report.push(`- **Operations/sec**: ${result.metrics.operationsPerSecond.toFixed(2)} (${this.formatChange(regression.changes.operationsPerSecond)})`);
        report.push(`- **Response time**: ${result.metrics.averageResponseTime.toFixed(2)}ms (${this.formatChange(regression.changes.averageResponseTime)})`);
        report.push(`- **Success rate**: ${result.metrics.successRate.toFixed(1)}% (${this.formatChange(regression.changes.successRate)})`);
        report.push(`- **Memory usage**: ${result.metrics.memoryUsageMB.toFixed(2)}MB (${this.formatChange(regression.changes.memoryUsage)})`);

        if (regression.alerts.length > 0) {
          report.push('- **Alerts**:');
          regression.alerts.forEach(alert => report.push(`  - ${alert}`));
        }

        if (regression.recommendations.length > 0) {
          report.push('- **Recommendations**:');
          regression.recommendations.slice(0, 3).forEach(rec => report.push(`  - ${rec}`));
        }
      } else {
        report.push('- **Status**: NEW (no baseline)');
        report.push(`- **Operations/sec**: ${result.metrics.operationsPerSecond.toFixed(2)}`);
        report.push(`- **Response time**: ${result.metrics.averageResponseTime.toFixed(2)}ms`);
        report.push(`- **Success rate**: ${result.metrics.successRate.toFixed(1)}%`);
        report.push(`- **Memory usage**: ${result.metrics.memoryUsageMB.toFixed(2)}MB`);
      }
      report.push('');
    });

    // Thresholds reference
    report.push('## Performance Thresholds');
    report.push(`- **Operations/sec**: Min ${this.thresholds.operationsPerSecond.min}, Target ${this.thresholds.operationsPerSecond.target}`);
    report.push(`- **Response time**: Max ${this.thresholds.responseTime.max}ms`);
    report.push(`- **Success rate**: Min ${this.thresholds.successRate.min}%`);
    report.push(`- **Memory usage**: Warning ${this.thresholds.memoryUsage.warningMB}MB, Max ${this.thresholds.memoryUsage.maxMB}MB`);
    report.push('');

    return report.join('\n');
  }

  /**
   * Calculate overall status from multiple test results
   */
  private calculateOverallStatus(testResults: Array<{ testName: string; metrics: PerformanceBenchmarkData['metrics'] }>): string {
    const statuses = testResults.map(result => {
      const regression = this.analyzeRegression(result.testName, result.metrics);
      return regression?.status || 'NEW';
    });

    if (statuses.includes('CRITICAL')) return '🚨 CRITICAL';
    if (statuses.includes('DEGRADED')) return '⚠️ DEGRADED';
    if (statuses.every(s => s === 'IMPROVED' || s === 'STABLE' || s === 'NEW')) return '✅ GOOD';
    return '📊 MIXED';
  }

  /**
   * Format change for display
   */
  private formatChange(change: { changePercent: number }): string {
    const percent = change.changePercent;
    const arrow = percent > 0 ? '↑' : percent < 0 ? '↓' : '→';
    const color = percent > 0 ? '+' : '';
    return `${arrow} ${color}${percent.toFixed(1)}%`;
  }

  /**
   * Export benchmarks to CSV for analysis
   */
  exportBenchmarksToCSV(testName?: string): string {
    const benchmarks = testName 
      ? this.loadBenchmarks(testName)
      : this.getAllBenchmarks();

    const csvHeader = [
      'testName', 'timestamp', 'version', 'operationsPerSecond', 
      'averageResponseTime', 'memoryUsageMB', 'successRate', 
      'p95ResponseTime', 'p99ResponseTime', 'itemCount', 'concurrency'
    ].join(',');

    const csvRows = benchmarks.map(b => [
      b.testName,
      b.timestamp,
      b.version,
      b.metrics.operationsPerSecond,
      b.metrics.averageResponseTime,
      b.metrics.memoryUsageMB,
      b.metrics.successRate,
      b.metrics.p95ResponseTime,
      b.metrics.p99ResponseTime,
      b.metadata.itemCount,
      b.metadata.concurrency
    ].join(','));

    return [csvHeader, ...csvRows].join('\n');
  }

  /**
   * Get all benchmarks
   */
  private getAllBenchmarks(): PerformanceBenchmarkData[] {
    const files = fs.readdirSync(this.benchmarkDir)
      .filter(file => file.endsWith('.json'))
      .sort();

    return files.map(file => {
      const content = fs.readFileSync(path.join(this.benchmarkDir, file), 'utf8');
      return JSON.parse(content) as PerformanceBenchmarkData;
    });
  }

  /**
   * Clean old benchmarks (keep only recent ones)
   */
  cleanOldBenchmarks(keepCount: number = 10): void {
    const testNames = new Set<string>();
    const allBenchmarks = this.getAllBenchmarks();

    // Group by test name
    allBenchmarks.forEach(b => testNames.add(b.testName));

    testNames.forEach(testName => {
      const benchmarks = this.loadBenchmarks(testName);
      
      if (benchmarks.length > keepCount) {
        const toDelete = benchmarks.slice(0, benchmarks.length - keepCount);
        
        toDelete.forEach(benchmark => {
          const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(benchmark.timestamp).getTime()}.json`;
          const filepath = path.join(this.benchmarkDir, filename);
          
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`🗑️ Cleaned old benchmark: ${filename}`);
          }
        });
      }
    });
  }
}

// Utility functions
export function createPerformanceBenchmark(benchmarkDir?: string, thresholds?: PerformanceThresholds): PerformanceBenchmark {
  return new PerformanceBenchmark(benchmarkDir, thresholds);
}

export { DEFAULT_THRESHOLDS };