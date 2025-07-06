/**
 * Smoke Test Suite for Post-Deployment Validation
 * 
 * This test suite validates that the Taskmaster system is functioning
 * correctly after deployment with health checks and critical path verification.
 */

import SmokeTestFramework from './smoke-test-framework';

describe('Smoke Tests - Post-Deployment Validation', () => {
  let smokeTests: SmokeTestFramework;

  beforeAll(() => {
    smokeTests = new SmokeTestFramework({
      githubToken: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER || 'cmbrose',
      repo: process.env.GITHUB_REPO || 'task-master-issues',
      verbose: process.env.DEBUG_TESTS === 'true'
    });
  });

  test('Complete Smoke Test Suite', async () => {
    const results = await smokeTests.runSmokeTests();
    
    // In test environment, we allow API tests to fail but require core tests to pass
    const coreTestCount = results.results.filter(r => 
      !r.testName.includes('GitHub API') || r.passed
    ).length;
    
    const criticalFailures = results.results.filter(r => 
      !r.passed && 
      !r.testName.includes('GitHub API') // API tests can fail in test environment
    );
    
    // Assert that core functionality tests passed
    expect(criticalFailures.length).toBe(0);
    
    // Verify we ran a reasonable number of tests
    expect(results.totalTests).toBeGreaterThanOrEqual(8);
    
    // Verify performance is reasonable (under 30 seconds for all tests)
    expect(results.duration).toBeLessThan(30000);
    
    // Log results for visibility
    console.log('\n📊 Detailed Test Results:');
    results.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const note = !result.passed && result.testName.includes('GitHub API') ? ' (expected in test env)' : '';
      console.log(`${status} ${result.testName} (${result.duration}ms)${note}`);
      if (!result.passed && result.error && !result.testName.includes('GitHub API')) {
        console.log(`   Error: ${result.error}`);
      }
    });

    // If any critical tests failed, provide detailed feedback
    if (criticalFailures.length > 0) {
      const failureDetails = criticalFailures.map(t => `${t.testName}: ${t.error}`).join('\n');
      throw new Error(`Critical smoke tests failed:\n${failureDetails}`);
    }
    
    console.log(`\n✅ Core smoke tests passed! (${results.passedTests}/${results.totalTests} total, ${criticalFailures.length} critical failures)`);
  }, 60000); // 60 second timeout for full suite
});

describe('Individual Smoke Test Components', () => {
  let smokeTests: SmokeTestFramework;

  beforeEach(() => {
    smokeTests = new SmokeTestFramework({
      githubToken: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER || 'cmbrose',
      repo: process.env.GITHUB_REPO || 'task-master-issues',
      verbose: false
    });
  });

  test('Node.js Environment Health Check', async () => {
    const result = await smokeTests.runTest('Node Environment Test', async () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      
      if (majorVersion < 18) {
        throw new Error(`Node.js version ${nodeVersion} is below minimum required (18.x)`);
      }
    });

    expect(result.passed).toBe(true);
    expect(result.duration).toBeLessThan(1000);
  });

  test('GitHub Actions Structure Validation', async () => {
    const result = await smokeTests.runTest('Actions Structure Test', async () => {
      const fs = require('fs').promises;
      const path = require('path');
      
      const expectedActions = [
        'actions/taskmaster-generate/action.yml',
        'actions/taskmaster-breakdown/action.yml',
        'actions/taskmaster-watcher/action.yml'
      ];

      for (const actionPath of expectedActions) {
        const fullPath = path.join(process.cwd(), actionPath);
        await fs.access(fullPath);
        
        const content = await fs.readFile(fullPath, 'utf-8');
        if (!content.includes('name:') || !content.includes('description:')) {
          throw new Error(`${actionPath} appears to be malformed`);
        }
      }
    });

    expect(result.passed).toBe(true);
  });

  test('Critical Path - Issue Creation Capability', async () => {
    const result = await smokeTests.runTest('Issue Creation Path Test', async () => {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Verify create-issues script exists
      const scriptPath = path.join(process.cwd(), 'create-issues.ts');
      await fs.access(scriptPath);
      
      // Basic syntax check
      const content = await fs.readFile(scriptPath, 'utf-8');
      if (!content.includes('createIssue') && !content.includes('issue')) {
        throw new Error('Issue creation script appears to be missing core functionality');
      }
    });

    expect(result.passed).toBe(true);
  });

  test('Critical Path - Configuration Loading', async () => {
    const result = await smokeTests.runTest('Configuration Loading Test', async () => {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Check for configuration examples
      const configFiles = [
        '.taskmaster.example.yml',
        '.taskmaster.example.json'
      ];
      
      let foundConfig = false;
      for (const configFile of configFiles) {
        try {
          await fs.access(path.join(process.cwd(), configFile));
          foundConfig = true;
          break;
        } catch {
          // Continue checking
        }
      }
      
      if (!foundConfig) {
        throw new Error('No configuration examples found');
      }
    });

    expect(result.passed).toBe(true);
  });

  test('Memory Usage Validation', async () => {
    const result = await smokeTests.runTest('Memory Usage Test', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      
      // Fail only on extreme memory usage (500MB+)
      if (heapUsedMB > 500) {
        throw new Error(`Excessive memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }
    });

    expect(result.passed).toBe(true);
  });

  test('File System Access Validation', async () => {
    const result = await smokeTests.runTest('File System Test', async () => {
      const fs = require('fs').promises;
      const path = require('path');
      
      const testDir = path.join(process.cwd(), 'tmp');
      const testFile = path.join(testDir, 'smoke-test-validation.txt');
      const testData = `smoke test - ${Date.now()}`;
      
      try {
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(testFile, testData);
        
        const readData = await fs.readFile(testFile, 'utf-8');
        if (readData !== testData) {
          throw new Error('File write/read mismatch');
        }
        
        await fs.unlink(testFile);
      } catch (error) {
        throw new Error(`File system test failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    expect(result.passed).toBe(true);
  });
});