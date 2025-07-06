# Smoke Testing Framework

## Overview

The Smoke Testing Framework provides post-deployment validation, health checks, and critical path verification for the Taskmaster system. It ensures that the system is functioning correctly after deployment and can catch critical issues early.

## Features

- **Post-Deployment Validation**: Comprehensive checks after system deployment
- **Health Monitoring**: Continuous monitoring of system health and API endpoints
- **Critical Path Verification**: Tests of core functionality like issue creation and dependency resolution
- **Performance Monitoring**: Memory usage and performance validation
- **API Health Checks**: GitHub API connectivity and rate limit monitoring
- **Infrastructure Validation**: Node.js environment, dependencies, and file system access

## Usage

### Quick Start

```bash
# Run smoke tests with npm scripts
npm run test:smoke                 # Basic smoke tests
npm run test:smoke:verbose         # Verbose output
npm run test:smoke:ci              # CI-friendly (no exit on failure)

# Run smoke tests directly
npx ts-node scripts/smoke-test-cli.ts --verbose
```

### Command Line Options

```bash
npx ts-node scripts/smoke-test-cli.ts [options]

Options:
  --help, -h                 Show help message
  --verbose, -v              Enable verbose output
  --github-token=<token>     GitHub API token for API health checks
  --owner=<owner>            GitHub repository owner
  --repo=<repo>              GitHub repository name
  --no-exit-on-failure       Don't exit with non-zero code on test failures
```

### Environment Variables

```bash
GITHUB_TOKEN=<token>          # GitHub API token
GITHUB_OWNER=<owner>          # Repository owner
GITHUB_REPO=<repo>            # Repository name
DEBUG_TESTS=true              # Enable debug output
NODE_ENV=test|production      # Environment mode
```

## Test Categories

### 1. Infrastructure Tests

- **Node.js Environment**: Version validation and basic functionality
- **Dependencies**: Required module availability
- **File System Access**: Read/write permissions and operations

### 2. Configuration Tests

- **GitHub API Configuration**: Token validation and format checking
- **Taskmaster Configuration**: Configuration file availability and structure
- **Workflow Configuration**: GitHub Actions workflow validation

### 3. GitHub Actions Tests

- **Actions Structure**: Validation of action.yml files and structure
- **Workflow Files**: Required workflows presence and validity
- **Action Inputs**: Input parameter validation

### 4. API Health Tests

- **GitHub API Health**: Connectivity and authentication
- **Rate Limits**: API rate limit monitoring and warnings
- **Error Handling**: API error recovery and graceful degradation

### 5. Critical Path Tests

- **Issue Creation**: Core issue creation functionality
- **Dependency Resolution**: Dependency graph analysis and resolution
- **Configuration Loading**: Configuration management system

### 6. Performance Tests

- **Memory Usage**: Memory consumption monitoring
- **Response Times**: Test execution performance
- **Resource Utilization**: System resource monitoring

## GitHub Workflow Integration

### Automatic Triggers

The smoke tests automatically run:

- **After Deployment**: Post-deployment validation
- **Scheduled**: Every 6 hours for continuous monitoring
- **On Release**: After successful releases
- **Manual**: Via workflow dispatch

### Workflow Features

- **Quick Smoke Tests**: Fast validation (10 minutes timeout)
- **Comprehensive Tests**: Full validation with API checks (15 minutes timeout)
- **Health Monitoring**: Lightweight health checks for scheduled runs
- **Post-Deployment Validation**: Thorough validation after deployments

### Example Workflow Configuration

```yaml
# Manual smoke test trigger
name: Manual Smoke Test
on:
  workflow_dispatch:
    inputs:
      verbose:
        description: 'Enable verbose output'
        default: false
        type: boolean

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:smoke:verbose
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## API Reference

### SmokeTestFramework Class

```typescript
import SmokeTestFramework from './src/tests/smoke-test-framework';

const smokeTests = new SmokeTestFramework({
  githubToken: 'ghp_...',
  owner: 'cmbrose',
  repo: 'task-master-issues',
  verbose: true
});

// Run complete test suite
const results = await smokeTests.runSmokeTests();

// Run individual test
const result = await smokeTests.runTest('Test Name', async () => {
  // Test implementation
});
```

### Test Result Interface

```typescript
interface SmokeTestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface SmokeTestSuite {
  suiteName: string;
  results: SmokeTestResult[];
  passed: boolean;
  totalTests: number;
  passedTests: number;
  duration: number;
}
```

## Configuration

### Test Environment Configuration

```typescript
// In test setup (src/tests/setup.ts)
process.env.NODE_ENV = 'test';
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';
```

### Jest Configuration

```javascript
// In jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 30000, // 30 seconds for smoke tests
  // ... other configuration
};
```

## Best Practices

### Writing Smoke Tests

1. **Keep Tests Fast**: Smoke tests should complete in under 30 seconds
2. **Test Core Functionality**: Focus on critical paths and essential features
3. **Handle Expected Failures**: Gracefully handle API limitations in test environments
4. **Provide Clear Feedback**: Include detailed error messages and suggestions
5. **Monitor Performance**: Track memory usage and execution time

### Test Organization

```typescript
// Group related tests
describe('Infrastructure Tests', () => {
  test('Node.js Environment', async () => { /* ... */ });
  test('Dependencies Available', async () => { /* ... */ });
});

describe('API Health Tests', () => {
  test('GitHub API Connectivity', async () => { /* ... */ });
  test('Rate Limits Check', async () => { /* ... */ });
});
```

### Error Handling

```typescript
// Graceful error handling
try {
  await performTest();
} catch (error) {
  if (isExpectedTestEnvironmentError(error)) {
    console.warn('⚠️ Expected test environment limitation:', error.message);
    return; // Don't fail the test
  }
  throw error; // Unexpected error - fail the test
}
```

## Monitoring and Alerting

### Success Metrics

- **Test Pass Rate**: Target 100% for core tests, 90%+ overall
- **Execution Time**: Under 30 seconds for full suite
- **Memory Usage**: Under 500MB heap usage
- **API Response Time**: Under 5 seconds for health checks

### Failure Response

1. **Critical Failures**: Immediate investigation required
2. **API Failures**: May be temporary - retry after 5 minutes
3. **Performance Issues**: Monitor trends and investigate if persistent
4. **Configuration Issues**: Update documentation and configuration

### Health Check Dashboard

The smoke tests provide structured output suitable for monitoring dashboards:

```json
{
  "suiteName": "Post-Deployment Smoke Tests",
  "passed": true,
  "totalTests": 12,
  "passedTests": 12,
  "duration": 8500,
  "timestamp": "2025-07-06T13:54:43.000Z"
}
```

## Troubleshooting

### Common Issues

#### API Authentication Failures
```
Error: GitHub API health check failed: Blocked by DNS monitoring proxy
```
**Solution**: This is expected in test environments. Use `--no-exit-on-failure` for CI.

#### Memory Warnings
```
⚠️ High memory usage detected: 400MB heap used
```
**Solution**: This is a warning, not a failure. Monitor trends and investigate if persistent.

#### Missing Dependencies
```
Error: Required dependency not found: @actions/core
```
**Solution**: Run `npm install` to install missing dependencies.

#### File System Permissions
```
Error: File system access test failed: EACCES
```
**Solution**: Check directory permissions and ensure `/tmp` is writable.

### Debug Mode

Enable detailed debugging:

```bash
DEBUG_TESTS=true npm run test:smoke:verbose
```

This provides:
- Detailed test execution logs
- API request/response details
- Memory usage tracking
- Performance metrics

## Contributing

### Adding New Smoke Tests

1. Add test to `SmokeTestFramework.runSmokeTests()`:
```typescript
await this.runTest('New Test Name', () => this.testNewFeature());
```

2. Implement test method:
```typescript
private async testNewFeature(): Promise<void> {
  // Test implementation
  if (conditionFails) {
    throw new Error('New feature test failed: reason');
  }
}
```

3. Add unit test in `src/tests/smoke-tests.test.ts`:
```typescript
test('New Feature Test', async () => {
  const result = await smokeTests.runTest('New Feature', async () => {
    // Test logic
  });
  expect(result.passed).toBe(true);
});
```

### Test Guidelines

- Tests should be deterministic and reproducible
- Use meaningful test names and error messages
- Handle test environment limitations gracefully
- Document expected behavior and failure modes
- Include performance expectations

## Examples

### Basic Health Check

```typescript
// Simple health check script
import SmokeTestFramework from './src/tests/smoke-test-framework';

const healthCheck = new SmokeTestFramework({
  verbose: true
});

const results = await healthCheck.runSmokeTests();
if (!results.passed) {
  console.error('Health check failed!');
  process.exit(1);
}
console.log('✅ System healthy');
```

### Custom Test

```typescript
// Custom smoke test
const customTest = await smokeTests.runTest('Custom Feature', async () => {
  const response = await fetch('/api/health');
  if (response.status !== 200) {
    throw new Error(`Health endpoint returned ${response.status}`);
  }
});

console.log(customTest.passed ? '✅' : '❌', customTest.testName);
```

### Integration with CI/CD

```bash
#!/bin/bash
# deployment-validation.sh

echo "🚀 Starting deployment validation..."

# Run smoke tests
npm run test:smoke:ci

if [ $? -eq 0 ]; then
  echo "✅ Deployment validation successful"
  exit 0
else
  echo "❌ Deployment validation failed"
  exit 1
fi
```

---

The Smoke Testing Framework provides a robust foundation for ensuring system reliability and catching issues early in the deployment process. It integrates seamlessly with existing CI/CD pipelines and provides clear, actionable feedback for maintaining system health.