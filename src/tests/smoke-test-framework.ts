/**
 * Smoke Testing Framework for Post-Deployment Validation
 * Tests critical functionality after deployment to ensure system health
 */

import { promises as fs } from 'fs';
import { createGitHubApiClient } from '../../scripts/github-api';
import * as path from 'path';

export interface SmokeTestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface SmokeTestSuite {
  suiteName: string;
  results: SmokeTestResult[];
  passed: boolean;
  totalTests: number;
  passedTests: number;
  duration: number;
}

export class SmokeTestFramework {
  private results: SmokeTestResult[] = [];
  private startTime: number = 0;

  constructor(private config: {
    githubToken?: string;
    owner?: string;
    repo?: string;
    verbose?: boolean;
  } = {}) {}

  /**
   * Run a single smoke test
   */
  async runTest(testName: string, testFn: () => Promise<void>): Promise<SmokeTestResult> {
    const start = Date.now();
    let result: SmokeTestResult;

    try {
      await testFn();
      result = {
        testName,
        passed: true,
        duration: Date.now() - start
      };
    } catch (error) {
      result = {
        testName,
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    this.results.push(result);
    
    if (this.config.verbose) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${testName} (${result.duration}ms)`);
      if (!result.passed) {
        console.log(`   Error: ${result.error}`);
      }
    }

    return result;
  }

  /**
   * Run full smoke test suite
   */
  async runSmokeTests(): Promise<SmokeTestSuite> {
    this.startTime = Date.now();
    this.results = [];

    console.log('🧪 Running Smoke Test Suite for Post-Deployment Validation...\n');

    // Core infrastructure tests
    await this.runTest('Verify Node.js Environment', () => this.testNodeEnvironment());
    await this.runTest('Verify Required Dependencies', () => this.testDependencies());
    await this.runTest('Verify GitHub API Configuration', () => this.testGitHubApiConfig());

    // GitHub Actions validation
    await this.runTest('Validate GitHub Actions Structure', () => this.testActionsStructure());
    await this.runTest('Validate Workflow Configuration', () => this.testWorkflowConfig());

    // API Health Checks
    if (this.config.githubToken) {
      await this.runTest('GitHub API Health Check', () => this.testGitHubApiHealth());
      await this.runTest('GitHub API Rate Limits', () => this.testGitHubApiRateLimits());
    }

    // Critical Path Tests
    await this.runTest('Test Issue Creation Capability', () => this.testIssueCreationPath());
    await this.runTest('Test Dependency Resolution', () => this.testDependencyResolutionPath());
    await this.runTest('Test Taskmaster Configuration', () => this.testTaskmasterConfig());

    // Performance and Resource Tests
    await this.runTest('Memory Usage Check', () => this.testMemoryUsage());
    await this.runTest('File System Access', () => this.testFileSystemAccess());

    return this.generateSuiteResults();
  }

  /**
   * Test Node.js environment and version
   */
  private async testNodeEnvironment(): Promise<void> {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js version ${nodeVersion} is below minimum required (18.x)`);
    }

    // Test basic Node.js features
    const testAsync = async () => 'async works';
    const result = await testAsync();
    
    if (result !== 'async works') {
      throw new Error('Basic async/await functionality failed');
    }
  }

  /**
   * Test that required dependencies are available
   */
  private async testDependencies(): Promise<void> {
    const requiredModules = [
      '@actions/core',
      '@actions/github',
      '@octokit/rest',
      'js-yaml'
    ];

    for (const module of requiredModules) {
      try {
        require.resolve(module);
      } catch (error) {
        throw new Error(`Required dependency not found: ${module}`);
      }
    }
  }

  /**
   * Test GitHub API configuration
   */
  private async testGitHubApiConfig(): Promise<void> {
    if (!this.config.githubToken && !process.env.GITHUB_TOKEN) {
      // This is a warning, not a failure for smoke tests
      console.warn('⚠️  GitHub token not configured - API tests will be skipped');
      return;
    }

    const token = this.config.githubToken || process.env.GITHUB_TOKEN;
    if (!token || token.length < 10) {
      throw new Error('GitHub token appears to be invalid or too short');
    }

    // Basic token format validation
    if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_')) {
      console.warn('⚠️  GitHub token format may be invalid (expected to start with ghp_, gho_, or ghu_)');
    }
  }

  /**
   * Test GitHub Actions structure
   */
  private async testActionsStructure(): Promise<void> {
    const expectedActions = [
      'actions/taskmaster-generate',
      'actions/taskmaster-breakdown', 
      'actions/taskmaster-watcher'
    ];

    for (const actionPath of expectedActions) {
      const actionYmlPath = path.join(process.cwd(), actionPath, 'action.yml');
      
      try {
        await fs.access(actionYmlPath);
        const content = await fs.readFile(actionYmlPath, 'utf-8');
        
        if (!content.includes('name:') || !content.includes('description:')) {
          throw new Error(`${actionPath}/action.yml appears to be malformed`);
        }
      } catch (error) {
        throw new Error(`GitHub Action not found or invalid: ${actionPath}`);
      }
    }
  }

  /**
   * Test workflow configuration
   */
  private async testWorkflowConfig(): Promise<void> {
    const workflowsDir = path.join(process.cwd(), '.github/workflows');
    
    try {
      const workflows = await fs.readdir(workflowsDir);
      const requiredWorkflows = ['taskmaster.yml', 'ci-cd-pipeline.yml'];
      
      for (const required of requiredWorkflows) {
        if (!workflows.includes(required)) {
          throw new Error(`Required workflow not found: ${required}`);
        }
      }
    } catch (error) {
      throw new Error('Workflows directory not accessible or malformed');
    }
  }

  /**
   * Test GitHub API health
   */
  private async testGitHubApiHealth(): Promise<void> {
    if (!this.config.githubToken) return;

    try {
      const client = createGitHubApiClient({
        token: this.config.githubToken,
        owner: this.config.owner || 'octocat',
        repo: this.config.repo || 'Hello-World'
      });

      // Perform basic health check if available
      if (typeof client.performHealthCheck === 'function') {
        const health = await client.performHealthCheck();
        if (!health.healthy) {
          throw new Error(`GitHub API health check failed: ${health.details?.error}`);
        }
      } else {
        // Fallback: test basic API access
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({ auth: this.config.githubToken });
        await octokit.rest.users.getAuthenticated();
      }
    } catch (error) {
      throw new Error(`GitHub API health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test GitHub API rate limits
   */
  private async testGitHubApiRateLimits(): Promise<void> {
    if (!this.config.githubToken) return;

    try {
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: this.config.githubToken });
      const rateLimit = await octokit.rest.rateLimit.get();
      
      const remaining = rateLimit.data.rate.remaining;
      const limit = rateLimit.data.rate.limit;
      
      if (remaining < (limit * 0.1)) {
        throw new Error(`GitHub API rate limit critically low: ${remaining}/${limit} remaining`);
      }
      
      if (remaining < (limit * 0.25)) {
        console.warn(`⚠️  GitHub API rate limit getting low: ${remaining}/${limit} remaining`);
      }
    } catch (error) {
      throw new Error(`Rate limit check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test issue creation critical path
   */
  private async testIssueCreationPath(): Promise<void> {
    // Test that the issue creation script exists and is syntactically valid
    const issueCreationScript = path.join(process.cwd(), 'create-issues.ts');
    
    try {
      await fs.access(issueCreationScript);
      
      // Basic syntax validation by attempting to compile
      const { execSync } = require('child_process');
      execSync(`npx tsc --noEmit ${issueCreationScript}`, { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Issue creation script validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test dependency resolution critical path
   */
  private async testDependencyResolutionPath(): Promise<void> {
    // Test that dependency scanning functionality is available
    try {
      // Basic test - just check if scripts exist and are accessible
      const fs = require('fs').promises;
      const path = require('path');
      
      const scriptPaths = [
        path.join(process.cwd(), 'scripts', 'issue-parser.ts'),
        path.join(process.cwd(), 'test', 'test-enhanced-dependency-scanning.ts')
      ];
      
      let foundDependencyLogic = false;
      for (const scriptPath of scriptPaths) {
        try {
          await fs.access(scriptPath);
          const content = await fs.readFile(scriptPath, 'utf-8');
          if (content.includes('DependencyGraphAnalyzer') || content.includes('dependency')) {
            foundDependencyLogic = true;
            break;
          }
        } catch {
          // Continue checking other paths
        }
      }
      
      if (!foundDependencyLogic) {
        throw new Error('Dependency resolution logic not found in expected locations');
      }
    } catch (error) {
      throw new Error(`Dependency resolution path test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test Taskmaster configuration
   */
  private async testTaskmasterConfig(): Promise<void> {
    const configPaths = [
      '.taskmaster.example.yml',
      '.taskmaster.example.json'
    ];

    let foundConfig = false;
    
    for (const configPath of configPaths) {
      try {
        await fs.access(path.join(process.cwd(), configPath));
        foundConfig = true;
        break;
      } catch {
        // Continue checking other paths
      }
    }

    if (!foundConfig) {
      throw new Error('No Taskmaster configuration examples found');
    }

    // Test configuration loading functionality if available
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Check if config management script exists
      const configScriptPath = path.join(process.cwd(), 'scripts', 'config-management.ts');
      try {
        await fs.access(configScriptPath);
        const content = await fs.readFile(configScriptPath, 'utf-8');
        if (!content.includes('loadConfig') && !content.includes('config')) {
          throw new Error('Configuration management functionality appears to be missing');
        }
      } catch {
        console.warn('⚠️  Configuration loading script not found - this may be expected');
      }
    } catch (error) {
      console.warn('⚠️  Configuration loading functionality not tested - module may not be available');
    }
  }

  /**
   * Test memory usage is within reasonable bounds
   */
  private async testMemoryUsage(): Promise<void> {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    
    // Warning thresholds (not failures for smoke tests)
    if (heapUsedMB > 100) {
      console.warn(`⚠️  High memory usage detected: ${heapUsedMB.toFixed(2)}MB heap used`);
    }
    
    if (heapTotalMB > 200) {
      console.warn(`⚠️  High memory allocation detected: ${heapTotalMB.toFixed(2)}MB heap total`);
    }
    
    // Only fail on extreme memory usage
    if (heapUsedMB > 500) {
      throw new Error(`Excessive memory usage: ${heapUsedMB.toFixed(2)}MB heap used`);
    }
  }

  /**
   * Test file system access
   */
  private async testFileSystemAccess(): Promise<void> {
    const testDir = path.join(process.cwd(), 'tmp');
    const testFile = path.join(testDir, 'smoke-test.txt');
    
    try {
      // Ensure tmp directory exists
      await fs.mkdir(testDir, { recursive: true });
      
      // Test write
      await fs.writeFile(testFile, 'smoke test data');
      
      // Test read
      const data = await fs.readFile(testFile, 'utf-8');
      if (data !== 'smoke test data') {
        throw new Error('File write/read mismatch');
      }
      
      // Cleanup
      await fs.unlink(testFile);
    } catch (error) {
      throw new Error(`File system access test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate final test suite results
   */
  private generateSuiteResults(): SmokeTestSuite {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    
    const suite: SmokeTestSuite = {
      suiteName: 'Post-Deployment Smoke Tests',
      results: this.results,
      passed: passedTests === totalTests,
      totalTests,
      passedTests,
      duration: totalDuration
    };

    // Print summary
    console.log('\n🏁 Smoke Test Results Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    console.log(`   Duration: ${totalDuration}ms`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (suite.passed) {
      console.log('\n✅ All smoke tests passed! System is healthy for deployment.');
    } else {
      console.log('\n❌ Some smoke tests failed. Review issues before proceeding.');
      
      // Show failed tests
      const failedTests = this.results.filter(r => !r.passed);
      failedTests.forEach(test => {
        console.log(`   ❌ ${test.testName}: ${test.error}`);
      });
    }

    return suite;
  }
}

export default SmokeTestFramework;