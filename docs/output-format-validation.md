# Output Format Validation

This module provides comprehensive output format validation for CLI outputs with support for JSON, XML, and plain text formats. It includes parsing, validation, conversion, error handling, and sanitization capabilities.

## Features

### Core Capabilities
- **Multi-format Support**: JSON, XML, and plain text parsing and validation
- **Automatic Format Detection**: Intelligent detection of output format
- **Format Conversion**: Convert between any supported formats
- **Output Sanitization**: Remove control characters and potentially harmful content
- **Error Handling**: Comprehensive error reporting for malformed output
- **Configuration Integration**: Seamless integration with the Taskmaster configuration system

### Validation Features
- **JSON**: Full syntax validation and structure parsing
- **XML**: Basic well-formedness checking and tag balance validation
- **Plain Text**: Always valid with metadata extraction (length, lines, etc.)
- **Size Limits**: Configurable maximum output size validation
- **Empty Content**: Configurable handling of empty outputs

### Sanitization Features
- **Control Characters**: Removes null bytes and harmful control characters
- **XSS Prevention**: Blocks `javascript:` schemes in JSON content
- **XML Safety**: Escapes dangerous XML entities
- **Format-specific**: Tailored sanitization rules for each format

## Usage

### Basic Validation

```typescript
import { validateOutput } from '@scripts/output-validation';

const result = validateOutput(cliOutput, {
  expectedFormat: 'json',
  sanitize: true,
  maxSize: 1048576
});

if (result.valid) {
  console.log('Parsed data:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}
```

### Format Detection

```typescript
import { detectOutputFormat } from '@scripts/output-validation';

const format = detectOutputFormat(output);
console.log('Detected format:', format); // 'json', 'xml', 'text', or null
```

### Format Conversion

```typescript
import { convertFormat } from '@scripts/output-validation';

const result = convertFormat(jsonOutput, {
  from: 'json',
  to: 'xml',
  pretty: true,
  rootElement: 'data'
});

if (result.success) {
  console.log('Converted output:', result.output);
}
```

### Configuration-based Processing

```typescript
import { processCliOutput } from '@scripts/output-processing';

const result = processCliOutput(rawOutput, {
  config: {
    outputFormat: 'json',
    outputSanitize: true,
    outputMaxSize: 2048
  },
  convertFormat: true
});
```

### Output Processor Factory

```typescript
import { createOutputProcessor } from '@scripts/output-processing';

const processor = createOutputProcessor({
  outputFormat: 'auto',
  outputSanitize: true,
  outputMaxSize: 1048576
});

// Process with configured settings
const result = processor.process(cliOutput);

// Validate only
const validation = processor.validate(cliOutput);
```

## Configuration

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `outputFormat` | `'json' \| 'xml' \| 'text' \| 'auto'` | `'auto'` | Expected or desired output format |
| `outputSanitize` | `boolean` | `true` | Whether to sanitize potentially harmful content |
| `outputMaxSize` | `number` | `1048576` | Maximum output size in bytes (1MB default) |

### Environment Variables

The system supports standard GitHub Actions environment variable conventions:

```bash
# Output format preference
INPUT_OUTPUT_FORMAT=json
TM_OUTPUT_FORMAT=json

# Sanitization setting
INPUT_OUTPUT_SANITIZE=true
TM_OUTPUT_SANITIZE=true

# Maximum size (in bytes)
INPUT_OUTPUT_MAX_SIZE=2048000
TM_OUTPUT_MAX_SIZE=2048000
```

### Configuration Files

Add output format preferences to your `.taskmaster.json` or `.taskmaster.yml` file:

```json
{
  "taskmaster": {
    "outputFormat": "json",
    "outputSanitize": true,
    "outputMaxSize": 2048000
  }
}
```

```yaml
taskmaster:
  outputFormat: json
  outputSanitize: true
  outputMaxSize: 2048000
```

## API Reference

### Types

```typescript
type OutputFormat = 'json' | 'xml' | 'text';

interface OutputValidationResult {
  valid: boolean;
  format?: OutputFormat;
  data?: any;
  errors: string[];
  sanitized?: string;
}

interface OutputValidationOptions {
  expectedFormat?: OutputFormat;
  autoDetect?: boolean;
  sanitize?: boolean;
  maxSize?: number;
  allowEmpty?: boolean;
}

interface ConversionResult {
  success: boolean;
  output?: string;
  errors: string[];
}
```

### Functions

#### `detectOutputFormat(output: string): OutputFormat | null`
Automatically detects the format of the given output.

#### `validateOutput(output: string, options?: OutputValidationOptions): OutputValidationResult`
Validates output with comprehensive checks including format validation, sanitization, and size limits.

#### `convertFormat(output: string, options: FormatConversionOptions): ConversionResult`
Converts output from one format to another.

#### `processCliOutput(rawOutput: string, options?: OutputProcessingOptions): OutputProcessingResult`
Complete processing pipeline that validates, sanitizes, and optionally converts CLI output based on configuration.

#### `sanitizeOutput(output: string, format: OutputFormat): string`
Removes potentially harmful content from output based on the specified format.

## Error Handling

The validation system provides detailed error messages for common issues:

- **JSON Errors**: Syntax errors with position information
- **XML Errors**: Tag balance and well-formedness issues  
- **Size Errors**: Clear indication when output exceeds limits
- **Format Errors**: Helpful messages for unsupported formats
- **Empty Content**: Configurable handling of empty outputs

Example error output:
```
Validation failed:
- Invalid JSON: Unexpected token 'j' at position 15
- Output exceeds maximum size of 1048576 bytes
```

## Integration

### With GitHub Actions

The output validation system integrates seamlessly with the existing Taskmaster GitHub Actions:

```yaml
- name: Run Taskmaster with Output Validation
  uses: cmbrose/task-master-issues@v1
  with:
    output-format: 'json'
    output-sanitize: 'true'
    output-max-size: '2048000'
```

### With Configuration Management

Output validation leverages the centralized configuration system:

```typescript
import { loadConfig } from '@scripts/config-management';
import { processCliOutput } from '@scripts/output-processing';

const config = loadConfig();
const result = processCliOutput(cliOutput, { config });
```

## Best Practices

1. **Use Auto-Detection**: Set `outputFormat: 'auto'` for flexibility
2. **Enable Sanitization**: Always use `outputSanitize: true` in production
3. **Set Reasonable Limits**: Configure `outputMaxSize` based on your needs
4. **Handle Errors Gracefully**: Always check validation results before using data
5. **Convert When Needed**: Use format conversion for interoperability
6. **Validate Early**: Validate CLI output as soon as it's received

## Security Considerations

- **XSS Prevention**: JSON sanitization blocks `javascript:` schemes
- **Control Characters**: All formats remove potentially harmful control characters
- **Size Limits**: Prevents memory exhaustion from oversized outputs
- **XML Safety**: Escapes dangerous XML entities to prevent XXE attacks
- **Input Validation**: Comprehensive validation prevents injection attacks