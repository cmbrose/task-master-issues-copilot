# Developer Guide

Comprehensive guide for developers working on the Task Master Issues system.

## Overview

This guide covers development setup, code organization, testing strategies, and contribution guidelines for the Task Master Issues project.

## Development Environment Setup

### Prerequisites
- Node.js 18+ with npm
- Git command line tools
- TypeScript knowledge
- GitHub account with repository access

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/cmbrose/task-master-issues.git
cd task-master-issues

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_username
GITHUB_REPO=task-master-issues
```

### Development Scripts
```bash
# Linting and type checking
npm run lint                    # TypeScript compilation check

# Testing (various test suites)
npm run test:unit              # Jest unit tests
npm run test:github-api-simple # Basic GitHub API test
npm run test:all              # Comprehensive test suite

# Development utilities
npm run demo:issue-parser      # Issue parsing demonstration
npm run demo:enhanced-management # Issue management demo
npm start                     # Run main issue creation script
```

## Code Organization

### Directory Structure
```
├── actions/                   # GitHub Actions implementations
│   ├── taskmaster-generate/   # Issue generation action
│   ├── taskmaster-breakdown/  # Issue breakdown action
│   └── taskmaster-watcher/    # Dependency monitoring action
├── scripts/                   # Core TypeScript modules
│   ├── github-api.ts         # Enhanced GitHub API client
│   ├── issue-parser.ts       # Issue content parsing utilities
│   └── ...                   # Other utility modules
├── test/                     # Test files and test utilities
├── docs/                     # Documentation files
├── demo/                     # Example usage demonstrations
└── src/                      # Additional source files and tests
    └── tests/                # Jest unit tests
```

### Core Modules

#### `scripts/github-api.ts`
Enhanced GitHub API client with retry logic, rate limiting, and error handling.

**Key Classes:**
- `EnhancedGitHubApi`: Main API client with enhanced features
- `GitHubApiError`: Structured error handling
- `CircuitBreaker`: Failure protection mechanism

**Key Features:**
- Automatic retry with exponential backoff
- Rate limit detection and queuing
- Priority-based operation handling
- Comprehensive error categorization
- Batch processing with controlled concurrency

#### `scripts/issue-parser.ts`
Utilities for parsing and manipulating GitHub issue content.

**Key Functions:**
- `parseIssueMetadata()`: Extract YAML frontmatter from issue bodies
- `parseDependencies()`: Parse dependency references from issue content
- `updateIssueWithDependencies()`: Add/update dependency sections in issues
- `validateIssueStructure()`: Validate issue format and content

#### Action Modules
Each action has its own TypeScript implementation:
- `actions/taskmaster-generate/src/main.ts`: PRD to issues generation
- `actions/taskmaster-breakdown/src/main.ts`: Issue breakdown logic
- `actions/taskmaster-watcher/src/main.ts`: Dependency monitoring

## Architecture Patterns

### Error Handling Strategy

```typescript
/**
 * Centralized error handling with categorization
 */
try {
  const result = await githubApi.executeWithRetry(
    () => operation(),
    'operation-description',
    OperationPriority.MEDIUM
  );
} catch (error) {
  const categorizedError = ErrorCategorizer.classifyError(error);
  
  switch (categorizedError.category) {
    case GitHubErrorCategory.RATE_LIMITED:
      // Handled automatically by retry mechanism
      break;
    case GitHubErrorCategory.AUTH:
      console.error('Authentication failed - check token permissions');
      break;
    case GitHubErrorCategory.VALIDATION:
      console.error('Invalid request parameters:', error.message);
      break;
  }
}
```

### Retry and Circuit Breaker Patterns

```typescript
/**
 * Automatic retry with circuit breaker protection
 */
class EnhancedGitHubApi {
  private circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    timeoutMs: 60000,
    resetTimeoutMs: 300000
  });

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    priority: OperationPriority = OperationPriority.MEDIUM
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return this.retryWithBackoff(operation, operationType, priority);
    });
  }
}
```

### Configuration Management

```typescript
/**
 * Hierarchical configuration loading
 */
class ConfigurationManager {
  static loadConfig(): TaskmasterConfig {
    const config = {
      // Default values
      complexity_threshold: 4,
      max_depth: 3,
      dry_run: false,
      
      // Override from environment
      ...this.loadFromEnvironment(),
      
      // Override from file
      ...this.loadFromFile(),
      
      // Override from GitHub secrets (in Actions)
      ...this.loadFromSecrets()
    };
    
    this.validateConfig(config);
    return config;
  }
}
```

## Development Guidelines

### Code Style

#### TypeScript Standards
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use interfaces for complex data structures
- Implement proper error handling
- Add comprehensive JSDoc comments

#### Example Interface Definition
```typescript
/**
 * Configuration for GitHub API operations
 */
interface GitHubApiConfig {
  /** GitHub personal access token */
  token: string;
  
  /** Repository owner (username or organization) */
  owner: string;
  
  /** Repository name */
  repo: string;
  
  /** Base URL for GitHub API (default: https://api.github.com) */
  baseURL?: string;
  
  /** Maximum number of retry attempts for failed operations */
  maxRetries?: number;
  
  /** Base delay in milliseconds between retry attempts */
  retryDelay?: number;
  
  /** Maximum number of concurrent API operations */
  concurrency?: number;
}
```

#### Error Handling Standards
```typescript
/**
 * Custom error class for GitHub API operations
 */
class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly category: GitHubErrorCategory,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
  
  /**
   * Create error from GitHub API response
   */
  static fromResponse(response: any, operation: string): GitHubApiError {
    const category = this.categorizeHttpError(response.status);
    const retryable = this.isRetryable(category);
    
    return new GitHubApiError(
      response.statusText || 'Unknown error',
      category,
      response.status,
      retryable,
      operation
    );
  }
}
```

### Testing Guidelines

#### Unit Testing with Jest
```typescript
/**
 * Example unit test for GitHub API client
 */
describe('EnhancedGitHubApi', () => {
  let api: EnhancedGitHubApi;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          create: jest.fn(),
          update: jest.fn(),
          get: jest.fn()
        }
      }
    } as any;

    api = new EnhancedGitHubApi({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });
  });

  describe('createIssue', () => {
    it('should create issue successfully', async () => {
      const issueData = {
        title: 'Test Issue',
        body: 'Test body',
        labels: ['test']
      };

      const expectedIssue = {
        number: 123,
        ...issueData
      };

      mockOctokit.rest.issues.create.mockResolvedValue({
        data: expectedIssue
      });

      const result = await api.createIssue(issueData);

      expect(result).toEqual(expectedIssue);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ...issueData
      });
    });

    it('should retry on rate limit error', async () => {
      mockOctokit.rest.issues.create
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({ data: { number: 123 } });

      const result = await api.createIssue({
        title: 'Test',
        body: 'Test'
      });

      expect(result.number).toBe(123);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(2);
    });
  });
});
```

#### Integration Testing
```typescript
/**
 * Integration test for end-to-end workflow
 */
describe('Issue Creation Workflow', () => {
  it('should create issues from PRD file', async () => {
    // Test with actual GitHub API (requires test repository)
    const api = new EnhancedGitHubApi({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.TEST_OWNER!,
      repo: process.env.TEST_REPO!
    });

    const prdContent = `
      # Test Feature
      ## Tasks
      - Setup: Configure environment (2 hours)
      - Implementation: Build feature (4 hours)
      - Testing: Add tests (2 hours)
    `;

    // Create issues from PRD
    const issues = await createIssuesFromPRD(api, prdContent);

    expect(issues).toHaveLength(3);
    expect(issues[0].title).toContain('Setup');
    expect(issues[1].title).toContain('Implementation');
    expect(issues[2].title).toContain('Testing');

    // Cleanup
    for (const issue of issues) {
      await api.closeIssue(issue.number);
    }
  });
});
```

### Performance Considerations

#### Batch Processing
```typescript
/**
 * Efficient batch processing with controlled concurrency
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 3
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

#### Rate Limiting
```typescript
/**
 * Intelligent rate limiting with priority queues
 */
class RateLimiter {
  private queue: PriorityQueue<QueuedOperation> = new PriorityQueue();
  private executing: Set<Promise<any>> = new Set();
  
  async execute<T>(
    operation: () => Promise<T>,
    priority: OperationPriority = OperationPriority.MEDIUM
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.enqueue({
        operation,
        resolve,
        reject,
        priority
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.executing.size >= this.maxConcurrency || this.queue.isEmpty()) {
      return;
    }
    
    const item = this.queue.dequeue();
    const promise = this.executeOperation(item);
    
    this.executing.add(promise);
    promise.finally(() => {
      this.executing.delete(promise);
      this.processQueue(); // Process next item
    });
  }
}
```

## API Development

### Adding New GitHub API Methods

```typescript
/**
 * Template for adding new API methods
 */
class EnhancedGitHubApi {
  /**
   * Add a new API method with proper error handling and retry logic
   */
  async newApiMethod(params: NewMethodParams): Promise<NewMethodResult> {
    return this.executeWithRetry(
      async () => {
        // Validate parameters
        this.validateParams(params);
        
        // Make API call
        const response = await this.octokit.rest.newEndpoint({
          owner: this.config.owner,
          repo: this.config.repo,
          ...params
        });
        
        // Process and return result
        return this.processResponse(response.data);
      },
      'new-api-method',
      OperationPriority.MEDIUM
    );
  }
  
  private validateParams(params: NewMethodParams): void {
    if (!params.requiredField) {
      throw new GitHubApiError(
        'Required field is missing',
        GitHubErrorCategory.VALIDATION,
        400,
        false,
        'new-api-method'
      );
    }
  }
}
```

### Error Handling Best Practices

```typescript
/**
 * Error categorization for appropriate handling
 */
enum GitHubErrorCategory {
  RATE_LIMITED = 'rate_limited',    // Automatic retry with backoff
  AUTH = 'authentication',          // Manual intervention required
  VALIDATION = 'validation',        // Fix parameters and retry
  NETWORK = 'network',             // Immediate retry
  SERVER = 'server',               // Delayed retry
  TIMEOUT = 'timeout',             // Retry with longer timeout
  UNKNOWN = 'unknown'              // Log and retry once
}

/**
 * Error classification logic
 */
class ErrorCategorizer {
  static classifyError(error: any): ClassifiedError {
    if (error.status === 403 && error.message.includes('rate limit')) {
      return {
        category: GitHubErrorCategory.RATE_LIMITED,
        retryable: true,
        maxRetries: 10,
        backoffMultiplier: 2
      };
    }
    
    if (error.status === 401 || error.status === 403) {
      return {
        category: GitHubErrorCategory.AUTH,
        retryable: false,
        maxRetries: 0
      };
    }
    
    // Additional classification logic...
    
    return {
      category: GitHubErrorCategory.UNKNOWN,
      retryable: true,
      maxRetries: 1
    };
  }
}
```

## GitHub Actions Development

### Action Structure
```
actions/action-name/
├── action.yml              # Action definition
├── src/
│   ├── main.ts            # Entry point
│   ├── action.ts          # Core logic
│   └── utils.ts           # Utility functions
├── dist/
│   └── index.js           # Compiled output (generated)
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript configuration
```

### Action Implementation Template
```typescript
/**
 * GitHub Action entry point
 */
import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionImplementation } from './action';

async function run(): Promise<void> {
  try {
    // Get action inputs
    const inputs = {
      token: core.getInput('github-token', { required: true }),
      config: core.getInput('config') || '{}',
      dryRun: core.getBooleanInput('dry-run')
    };
    
    // Initialize action
    const action = new ActionImplementation(inputs, github.context);
    
    // Execute action logic
    const result = await action.execute();
    
    // Set action outputs
    core.setOutput('issues-created', result.issuesCreated.toString());
    core.setOutput('artifacts-uploaded', result.artifactsUploaded.toString());
    
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
```

### Building Actions
```bash
# Build individual action
npm run build:generate

# Build all actions
npm run build:actions

# The build process:
# 1. Compiles TypeScript to JavaScript
# 2. Bundles dependencies with @vercel/ncc
# 3. Outputs single dist/index.js file
```

## Debugging and Troubleshooting

### Debug Logging
```typescript
/**
 * Structured logging for debugging
 */
class Logger {
  static debug(message: string, context?: any): void {
    if (process.env.TASKMASTER_DEBUG === 'true') {
      console.log(`[DEBUG] ${message}`, context ? JSON.stringify(context, null, 2) : '');
    }
  }
  
  static info(message: string, context?: any): void {
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  }
  
  static error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error?.stack || error?.message || '');
  }
}
```

### Common Development Issues

#### Issue: TypeScript compilation errors
```bash
# Check TypeScript configuration
npm run lint

# Fix common issues:
# 1. Add missing type definitions
# 2. Update tsconfig.json paths
# 3. Install missing @types packages
```

#### Issue: GitHub API rate limiting during development
```bash
# Use personal access token with higher limits
# Add rate limiting configuration
export GITHUB_TOKEN=ghp_your_token_here
export TASKMASTER_CONCURRENCY=1  # Reduce concurrency for testing
```

#### Issue: Action not building correctly
```bash
# Clean and rebuild
rm -rf actions/*/dist
npm run build:actions

# Check for common issues:
# 1. Missing dependencies in package.json
# 2. TypeScript errors
# 3. Incorrect action.yml configuration
```

### Testing in Development

#### Local Testing
```bash
# Test individual components
npm run test:github-api-simple
npm run test:sub-issues-api

# Test with real GitHub API (requires tokens)
npm run test:integration-hierarchy

# Run comprehensive test suite
npm run test:all
```

#### Testing Actions Locally
```bash
# Test action inputs and configuration
node -e "
const action = require('./actions/taskmaster-generate/dist/index.js');
// Test action logic locally
"

# Use act tool for local GitHub Actions testing
npm install -g @nektos/act
act -s GITHUB_TOKEN=your_token_here
```

## Contributing Guidelines

### Development Workflow
1. **Fork and Clone**: Fork repository and clone locally
2. **Create Branch**: Create feature branch from main
3. **Develop**: Make changes following coding standards
4. **Test**: Run comprehensive test suite
5. **Document**: Update documentation as needed
6. **Submit PR**: Create pull request with clear description

### Pull Request Template
```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
```

### Code Review Guidelines
- **Functionality**: Does the code work as intended?
- **Performance**: Are there any performance implications?
- **Security**: Are there any security concerns?
- **Maintainability**: Is the code easy to understand and maintain?
- **Testing**: Is the code adequately tested?

## Advanced Topics

### Custom Issue Parsers
```typescript
/**
 * Implement custom issue content parsers
 */
interface IssueParser {
  parse(content: string): ParsedIssue;
  format(issue: ParsedIssue): string;
}

class CustomIssueParser implements IssueParser {
  parse(content: string): ParsedIssue {
    // Custom parsing logic
    const metadata = this.extractMetadata(content);
    const dependencies = this.extractDependencies(content);
    const description = this.extractDescription(content);
    
    return {
      metadata,
      dependencies,
      description,
      // Additional custom fields
    };
  }
}
```

### Plugin Architecture
```typescript
/**
 * Plugin system for extending functionality
 */
interface TaskmasterPlugin {
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  processIssue?(issue: GitHubIssue): Promise<GitHubIssue>;
  processTask?(task: Task): Promise<Task>;
}

class PluginManager {
  private plugins: TaskmasterPlugin[] = [];
  
  async loadPlugin(plugin: TaskmasterPlugin): Promise<void> {
    await plugin.initialize(this.createContext());
    this.plugins.push(plugin);
  }
  
  async processWithPlugins<T>(
    item: T,
    processorName: keyof TaskmasterPlugin
  ): Promise<T> {
    let result = item;
    
    for (const plugin of this.plugins) {
      const processor = plugin[processorName];
      if (typeof processor === 'function') {
        result = await processor.call(plugin, result);
      }
    }
    
    return result;
  }
}
```

## Related Documentation

- [API Reference](./api-reference.md) - Complete API documentation
- [User Guide](./user-guide.md) - User-facing documentation
- [Architecture Overview](./architecture-overview.md) - System design and components
- [Deployment Guide](./deployment-guide.md) - Deployment instructions