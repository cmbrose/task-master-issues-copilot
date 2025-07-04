/**
 * Output Processing Integration Module
 * 
 * Provides integration between output format validation and configuration management.
 * Combines the validation system with user preferences from configuration.
 */

import { 
  validateOutput, 
  convertFormat, 
  detectOutputFormat,
  type OutputFormat,
  type OutputValidationResult,
  type ConversionResult 
} from './output-validation';
import { type TaskmasterConfig } from './config-management';

/**
 * Options for processing CLI output with configuration
 */
export interface OutputProcessingOptions {
  /** Configuration to use for processing */
  config?: Partial<TaskmasterConfig>;
  /** Override the configured output format */
  outputFormat?: OutputFormat | 'auto';
  /** Override sanitization setting */
  sanitize?: boolean;
  /** Override max size setting */
  maxSize?: number;
  /** Whether to convert output to the desired format */
  convertFormat?: boolean;
  /** Whether to allow empty output */
  allowEmpty?: boolean;
}

/**
 * Result of processing CLI output
 */
export interface OutputProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Original validation result */
  validation: OutputValidationResult;
  /** Conversion result (if conversion was performed) */
  conversion?: ConversionResult;
  /** Final processed output */
  output: string;
  /** Any processing errors */
  errors: string[];
  /** Detected or configured format */
  format: OutputFormat;
  /** Whether the output was sanitized */
  sanitized: boolean;
}

/**
 * Process CLI output according to configuration and options
 */
export function processCliOutput(
  rawOutput: string,
  options: OutputProcessingOptions = {}
): OutputProcessingResult {
  const result: OutputProcessingResult = {
    success: false,
    validation: { valid: false, errors: [] },
    output: rawOutput,
    errors: [],
    format: 'text',
    sanitized: false
  };

  try {
    // Get configuration values
    const config = options.config || {};
    const targetFormat = options.outputFormat || config.outputFormat || 'auto';
    const shouldSanitize = options.sanitize !== undefined ? options.sanitize : 
                          (config.outputSanitize !== undefined ? config.outputSanitize : true);
    const maxSize = options.maxSize || config.outputMaxSize || 1048576;
    const allowEmpty = options.allowEmpty !== undefined ? options.allowEmpty : false;

    // Detect format if auto
    const detectedFormat = detectOutputFormat(rawOutput);
    const actualFormat = targetFormat === 'auto' ? (detectedFormat || 'text') : targetFormat as OutputFormat;
    
    result.format = actualFormat;
    result.sanitized = shouldSanitize;

    // Validate the output
    result.validation = validateOutput(rawOutput, {
      expectedFormat: actualFormat,
      autoDetect: targetFormat === 'auto',
      sanitize: shouldSanitize,
      maxSize: maxSize,
      allowEmpty: allowEmpty
    });

    // If validation failed, return early
    if (!result.validation.valid) {
      result.errors.push(...result.validation.errors);
      return result;
    }

    // Use sanitized output if available
    let processedOutput = result.validation.sanitized || rawOutput;
    
    // Convert format if needed and requested
    if (options.convertFormat && detectedFormat && detectedFormat !== actualFormat) {
      result.conversion = convertFormat(processedOutput, {
        from: detectedFormat,
        to: actualFormat,
        pretty: true
      });

      if (!result.conversion.success) {
        result.errors.push(...result.conversion.errors);
        return result;
      }

      processedOutput = result.conversion.output || processedOutput;
    }

    result.output = processedOutput;
    result.success = true;
    
  } catch (error) {
    result.errors.push(`Processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Validate CLI output against configuration rules
 * Simplified version that just validates without processing
 */
export function validateCliOutput(
  rawOutput: string,
  config: Partial<TaskmasterConfig> = {}
): OutputValidationResult {
  const targetFormat = config.outputFormat || 'auto';
  const shouldSanitize = config.outputSanitize !== undefined ? config.outputSanitize : true;
  const maxSize = config.outputMaxSize || 1048576;

  return validateOutput(rawOutput, {
    expectedFormat: targetFormat === 'auto' ? undefined : targetFormat as OutputFormat,
    autoDetect: targetFormat === 'auto',
    sanitize: shouldSanitize,
    maxSize: maxSize,
    allowEmpty: false
  });
}

/**
 * Helper to get output processing configuration from environment
 */
export function getOutputConfigFromEnvironment(): Partial<TaskmasterConfig> {
  const config: Partial<TaskmasterConfig> = {};

  // Check for output format configuration
  const outputFormat = process.env.TM_OUTPUT_FORMAT || 
                      process.env.INPUT_OUTPUT_FORMAT || 
                      process.env.INPUT_OUTPUT__FORMAT;
  if (outputFormat) {
    config.outputFormat = outputFormat as any;
  }

  // Check for sanitization setting
  const outputSanitize = process.env.TM_OUTPUT_SANITIZE || 
                        process.env.INPUT_OUTPUT_SANITIZE || 
                        process.env.INPUT_OUTPUT__SANITIZE;
  if (outputSanitize) {
    config.outputSanitize = outputSanitize.toLowerCase() === 'true' || outputSanitize === '1';
  }

  // Check for max size setting
  const outputMaxSize = process.env.TM_OUTPUT_MAX_SIZE || 
                       process.env.INPUT_OUTPUT_MAX_SIZE || 
                       process.env.INPUT_OUTPUT__MAX__SIZE;
  if (outputMaxSize) {
    const size = parseInt(outputMaxSize, 10);
    if (!isNaN(size) && size > 0) {
      config.outputMaxSize = size;
    }
  }

  return config;
}

/**
 * Create a complete output processor with default configuration
 */
export function createOutputProcessor(config: Partial<TaskmasterConfig> = {}) {
  return {
    /**
     * Process output with the configured settings
     */
    process: (rawOutput: string, options: Partial<OutputProcessingOptions> = {}) => {
      return processCliOutput(rawOutput, { ...options, config });
    },

    /**
     * Validate output with the configured settings
     */
    validate: (rawOutput: string) => {
      return validateCliOutput(rawOutput, config);
    },

    /**
     * Get the current configuration
     */
    getConfig: () => ({ ...config }),

    /**
     * Update the configuration
     */
    updateConfig: (newConfig: Partial<TaskmasterConfig>) => {
      Object.assign(config, newConfig);
    }
  };
}