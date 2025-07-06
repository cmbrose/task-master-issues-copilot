# Integration Testing Framework

## Overview

The Integration Testing Framework provides comprehensive testing for the Task Master Issues system, covering API endpoints, database interactions, and service integrations. This framework ensures all components work together correctly and maintains system reliability.

## Architecture

The framework consists of several specialized test suites:

### Core Components

1. **Integration Test Framework** (`src/tests/integration-test-framework.ts`)
   - Orchestrates all test suites
   - Provides comprehensive reporting
   - Manages test execution and results

2. **API Endpoint Tests** (`src/tests/api-endpoint-tests.ts`)
   - Tests GitHub API interactions
   - Validates CRUD operations
   - Tests error handling and rate limiting

3. **Database Integration Tests** (`src/tests/database-integration-tests.ts`)
   - Tests data persistence and retrieval
   - Validates relationship management
   - Tests transaction handling and idempotency

4. **Service Integration Tests** (`src/tests/service-integration-tests.ts`)
   - Tests GitHub Actions workflows
   - Validates trigger configurations
   - Tests artifact handling

## Test Categories

### 1. API Integration Tests
- **Issue Operations**: Create, read, update, delete issues
- **Sub-Issue Management**: Parent-child relationships
- **Dependency Tracking**: Dependency parsing and resolution
- **Label Management**: Adding and removing labels
- **Comment Operations**: Creating and listing comments
- **Error Handling**: Network errors, rate limits, authentication
- **Rate Limiting**: Rate limit detection and retry logic

### 2. Database Integration Tests
- **CRUD Operations**: Basic create, read, update, delete
- **Relationship Management**: Parent-child and dependency relationships
- **Dependency Tracking**: Chain resolution and circular dependency detection
- **State Management**: State transitions and history tracking
- **Transaction Handling**: Atomic operations with rollback
- **Data Integrity**: Referential integrity and consistency
- **Query Operations**: Filtering and searching

### 3. Service Integration Tests
- **Workflow Configuration**: GitHub Actions workflow validation
- **Action Configuration**: Action definition validation
- **Trigger Configuration**: Event trigger testing
- **Job Dependencies**: Job dependency verification
- **Environment Variables**: Environment variable management
- **Secret Management**: Security and secret handling
- **Artifact Handling**: Artifact upload/download capabilities

### 4. End-to-End Tests
- **E2E Issue Hierarchy**: Complete workflow testing
- **Comprehensive Error Handling**: Error recovery scenarios
- **Taskgraph Replay Workflow**: Workflow replay capabilities

### 5. Data Processing Tests
- **Batch Processing**: Large dataset handling
- **Metadata Extractor**: Metadata extraction and processing
- **Enhanced Validation**: Data validation rules
- **Comment Parser**: Comment parsing functionality

### 6. Artifact Management Tests
- **Artifact Capabilities**: Artifact creation and management
- **Artifact Recovery**: Recovery from failures
- **Artifact Download Validation**: Download verification
- **Artifact Retention**: Retention policy testing
- **Artifact Cleanup**: Cleanup operations

## Usage

### Running All Integration Tests

```bash
npm run test:integration-framework
```

This command runs the complete integration testing framework and provides a comprehensive report.

### Running Individual Test Suites

```bash
# API endpoint tests
npm run test:api-endpoints

# Database integration tests
npm run test:database-integration

# Service integration tests
npm run test:service-integration

# Unit tests (Jest)
npm run test:unit
```

### Running Existing Integration Tests

```bash
# GitHub API tests
npm run test:github-api-simple

# Sub-issues API tests
npm run test:sub-issues-api

# Dependency tracking tests
npm run test:dependency-tracking

# Error handling tests
npm run test:enhanced-error-handling

# All existing tests
npm run test:all
```

## Configuration

### Test Environment Variables

The framework supports several environment variables for configuration:

```bash
# Enable real API testing (use with caution)
export TEST_REAL_API=true
export GITHUB_TOKEN=your_github_token
export TEST_REPO_OWNER=your_github_username
export TEST_REPO_NAME=your_test_repo

# Test mode (default: true for safety)
export TM_TEST_MODE=true
```

### Mock vs Real API Testing

By default, tests run in mock mode for safety and speed. To test against real GitHub API:

1. Set `TEST_REAL_API=true`
2. Provide a valid `GITHUB_TOKEN`
3. Specify test repository details
4. **Warning**: This will make actual API calls and may create/modify issues

## Test Reports

The framework generates detailed reports including:

- Overall test statistics
- Suite-by-suite breakdown
- Failed test details
- Coverage analysis
- Performance metrics

Reports are saved to `integration-test-results.json` for programmatic access.

## Adding New Tests

### Creating a New Test Suite

1. Create a new file in `src/tests/`
2. Implement test methods following the existing pattern
3. Add the test suite to the integration framework
4. Update package.json with new npm script

Example structure:

```typescript
export class MyTestSuite {
  private testResults: any[] = [];

  async runAllTests(): Promise<void> {
    // Implementation
  }

  generateReport(): string {
    // Implementation
  }
}
```

### Adding Tests to Existing Suites

Add new test methods to existing test suites and call them from `runAllTests()`.

## Jest Unit Tests

The framework includes Jest for unit testing with:

- TypeScript support via ts-jest
- Custom Jest matchers for domain objects
- Mock utilities for GitHub API and task data
- Test environment configuration

### Running Jest Tests

```bash
# Run unit tests
npm run test:unit

# Run with coverage
npm run test:unit:coverage

# Run in watch mode
npm run test:unit:watch

# Run with verbose output
npm run test:unit:verbose
```

## Best Practices

### Test Isolation
- Each test should be independent
- Use setup/teardown methods for clean state
- Avoid shared state between tests

### Mock Data
- Use realistic mock data
- Test edge cases and error conditions
- Maintain mock data consistency

### Error Testing
- Test both success and failure scenarios
- Verify error messages and codes
- Test recovery mechanisms

### Performance
- Monitor test execution time
- Optimize slow tests
- Use timeouts appropriately

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout values for long-running tests
2. **API Rate Limits**: Use mock mode or implement backoff strategies
3. **Dependency Issues**: Ensure all dependencies are installed
4. **Environment Variables**: Check configuration and permissions

### Debug Mode

Enable debug logging for troubleshooting:

```bash
export DEBUG=taskmaster:test
npm run test:integration-framework
```

## Coverage Goals

The integration testing framework aims for:

- **API Coverage**: All GitHub API endpoints used by the system
- **Database Coverage**: All data operations and relationships
- **Service Coverage**: All GitHub Actions workflows and triggers
- **Error Coverage**: All error scenarios and recovery paths
- **Integration Coverage**: All component interactions

## Maintenance

### Regular Tasks

1. Update tests when adding new features
2. Review and update mock data
3. Monitor test performance and reliability
4. Update documentation with changes

### Test Data Management

- Keep test data minimal but comprehensive
- Update mock responses when API changes
- Maintain test database schemas

### CI/CD Integration

The framework is designed to integrate with continuous integration:

- All tests should pass before deployment
- Generate test reports for build artifacts
- Monitor test trends and reliability

## Security Considerations

- Never commit real API tokens
- Use test repositories for real API testing
- Limit permissions for test tokens
- Review test data for sensitive information

## Contributing

When contributing to the testing framework:

1. Follow existing patterns and conventions
2. Add comprehensive test coverage for new features
3. Update documentation
4. Ensure tests are reliable and deterministic
5. Consider both positive and negative test cases

## Related Documentation

- [Unit Test Implementation](./unit-test-implementation.md)
- [Sub-Issues API Integration](./sub-issues-api-integration.md)
- [Configuration Management](./configuration-management.md)