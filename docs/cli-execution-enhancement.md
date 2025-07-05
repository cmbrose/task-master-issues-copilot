# CLI Execution Enhancement Documentation

## Overview

The CLI execution functionality has been enhanced to provide robust, reliable execution of Taskmaster CLI with comprehensive error handling, retry mechanisms, and monitoring capabilities.

## Key Features

### 1. **Dependency Installation & Verification**
- Automatic binary download and version pinning via `setupTaskmasterCli()`
- Pre-execution dependency verification
- Binary executability checks
- Platform-specific support (Linux, Windows, macOS with x64/arm64)

### 2. **Enhanced CLI Execution**
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Error Categorization**: Intelligent error classification (timeout, process, validation, network, unknown)
- **Progress Monitoring**: Real-time execution progress reporting
- **Graceful Shutdown**: SIGINT followed by SIGTERM for clean termination

### 3. **Comprehensive Parameter Handling**
- **Input Validation**: Strict validation of all CLI parameters
- **Flexible Configuration**: Support for additional CLI arguments
- **Path Resolution**: Automatic absolute path resolution
- **Working Directory**: Configurable execution context

### 4. **Advanced Timeout Controls**
- **Configurable Timeouts**: 1 second to 1 hour range
- **Progress Updates**: Regular status updates during long operations
- **Graceful Termination**: 5-second grace period before force termination
- **Resource Cleanup**: Automatic cleanup of resources and handles

### 5. **Enhanced Error Handling**
- **Detailed Error Reporting**: Comprehensive error messages with context
- **Exit Code Analysis**: Intelligent exit code interpretation
- **Stderr Processing**: Real-time stderr capture and analysis
- **Recovery Strategies**: Automatic retry for transient failures

### 6. **Execution Monitoring**
- **Real-time Output**: Live stdout/stderr streaming
- **Execution Metrics**: Duration tracking and attempt counting
- **Progress Reporting**: Status updates every 30 seconds during execution
- **Resource Monitoring**: Memory and process state tracking

## API Reference

### TaskmasterRunOptions Interface

```typescript
interface TaskmasterRunOptions {
  prdPath: string;                    // Required: Path to PRD file
  complexityThreshold?: number;       // Default: 40 (1-100)
  maxDepth?: number;                  // Default: 3 (1-10)
  additionalArgs?: string[];          // Optional CLI arguments
  outputPath?: string;                // Default: './task-graph.json'
  workingDir?: string;                // Default: process.cwd()
  timeout?: number;                   // Default: 300000ms (1s-1h)
  retryAttempts?: number;             // Default: 2 (0-5)
  retryDelay?: number;                // Default: 1000ms
  enableProgressMonitoring?: boolean; // Default: true
  gracefulShutdown?: boolean;         // Default: true
}
```

### TaskmasterRunResult Interface

```typescript
interface TaskmasterRunResult {
  exitCode: number;                   // CLI exit code
  stdout: string;                     // Complete stdout output
  stderr: string;                     // Complete stderr output
  taskGraphPath: string;              // Path to generated file
  taskGraphGenerated: boolean;        // Success indicator
  attemptsCount: number;              // Number of execution attempts
  duration: number;                   // Total execution time (ms)
  errorCategory?: string;             // Error classification
}
```

## Usage Examples

### Basic Execution
```typescript
const result = await runTaskmasterCli(binaryInfo, {
  prdPath: './docs/product.prd.md',
  complexityThreshold: 40,
  maxDepth: 3
});
```

### Advanced Configuration
```typescript
const result = await runTaskmasterCli(binaryInfo, {
  prdPath: './docs/product.prd.md',
  complexityThreshold: 60,
  maxDepth: 4,
  timeout: 600000,              // 10 minutes
  retryAttempts: 3,             // Try up to 4 times
  retryDelay: 2000,             // 2 second delay between retries
  enableProgressMonitoring: true,
  gracefulShutdown: true,
  additionalArgs: ['--verbose', '--debug']
});
```

### Error Handling
```typescript
try {
  const result = await runTaskmasterCli(binaryInfo, options);
  console.log(`Success! Generated in ${result.duration}ms`);
} catch (error) {
  const errorCategory = categorizeError(error);
  switch (errorCategory) {
    case 'timeout':
      console.log('Increase timeout or reduce complexity');
      break;
    case 'validation':
      console.log('Check input parameters and PRD file');
      break;
    case 'network':
      console.log('Check network connectivity');
      break;
    default:
      console.log('Unexpected error occurred');
  }
}
```

## Error Categories

| Category   | Description | Common Causes | Recommended Actions |
|------------|-------------|---------------|-------------------|
| `timeout`  | Execution exceeded time limit | Large PRD, high complexity | Increase timeout, reduce scope |
| `process`  | Binary execution failed | Missing binary, permissions | Check installation, permissions |
| `validation` | Invalid parameters/inputs | Bad arguments, missing files | Validate inputs, check file paths |
| `network` | Network-related failures | Download issues, connectivity | Check network, retry later |
| `unknown` | Unclassified errors | Various | Check logs, contact support |

## Configuration Best Practices

1. **Timeout Settings**
   - Small PRDs (< 10 features): 60-120 seconds
   - Medium PRDs (10-50 features): 300-600 seconds  
   - Large PRDs (50+ features): 900-1800 seconds

2. **Retry Strategy**
   - Use 2-3 retry attempts for production
   - Set retry delay to 1-2 seconds
   - Disable retries for validation errors

3. **Progress Monitoring**
   - Enable for long-running operations (> 60s)
   - Useful for debugging timeout issues
   - Provides user feedback in CI/CD

4. **Resource Management**
   - Use graceful shutdown for clean termination
   - Monitor execution duration for optimization
   - Clean up temporary files after execution

## Testing

The implementation includes comprehensive tests:

- **Basic Integration Tests**: `test-cli.ts`
- **Enhanced Feature Tests**: `test-enhanced-cli.ts`
- **Error Simulation**: Validation and error handling tests
- **Mock Scenarios**: Simulated CLI executions for testing

Run tests with:
```bash
npm run build
npx ts-node test-cli.ts
npx ts-node test-enhanced-cli.ts
```

## Integration

This enhanced CLI execution is integrated into:

- **taskmaster-generate action**: Main task graph generation
- **taskmaster-breakdown action**: Recursive task breakdown  
- **taskmaster-watcher action**: Event-driven processing

The enhanced features ensure reliable execution across all GitHub Actions workflows.