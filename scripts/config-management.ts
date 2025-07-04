/**
 * Configuration Management Module
 * 
 * Provides centralized configuration handling with support for:
 * - Configuration file loading (JSON/YAML)
 * - Environment variable resolution  
 * - Parameter validation and sanitization
 * - Default value management
 * - Configuration persistence
 * - Priority-based overrides (files < env vars < action inputs)
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Core configuration parameters used across all Taskmaster actions
 */
export interface TaskmasterConfig {
  // Task generation parameters
  complexityThreshold: number;
  maxDepth: number;
  prdPathGlob: string;
  
  // Breakdown parameters
  breakdownMaxDepth: number;
  
  // Watcher parameters
  scanMode: 'webhook' | 'full';
  
  // CLI parameters
  taskmasterVersion: string;
  taskmasterBaseUrl: string;
  taskmasterArgs: string;
  forceDownload: boolean;
  
  // GitHub integration
  githubToken: string;
  
  // Action mode
  actionMode: 'generate' | 'breakdown' | 'watcher' | 'full';
  
  // Output format preferences
  outputFormat: 'json' | 'xml' | 'text' | 'auto';
  outputSanitize: boolean;
  outputMaxSize: number;
}

/**
 * Configuration file structure for JSON/YAML files
 */
export interface ConfigFile {
  taskmaster?: Partial<TaskmasterConfig>;
  defaults?: Partial<TaskmasterConfig>;
  environments?: {
    [env: string]: Partial<TaskmasterConfig>;
  };
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /** Base directory to search for config files */
  baseDir?: string;
  /** Environment name for environment-specific config */
  environment?: string;
  /** Additional config file paths to load */
  configPaths?: string[];
  /** Whether to validate configuration after loading */
  validate?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: TaskmasterConfig = {
  complexityThreshold: 40,
  maxDepth: 3,
  prdPathGlob: 'docs/**.prd.md',
  breakdownMaxDepth: 2,
  scanMode: 'webhook',
  taskmasterVersion: '1.0.0',
  taskmasterBaseUrl: 'https://github.com/taskmaster-ai/taskmaster/releases/download',
  taskmasterArgs: '',
  forceDownload: false,
  githubToken: '',
  actionMode: 'full',
  outputFormat: 'auto',
  outputSanitize: true,
  outputMaxSize: 1048576 // 1MB default
};

/**
 * Configuration validation rules
 */
export interface ValidationRule<T = any> {
  key: keyof TaskmasterConfig;
  validate: (value: T) => boolean | string;
  sanitize?: (value: T) => T;
}

/**
 * Built-in validation rules
 */
export const VALIDATION_RULES: ValidationRule[] = [
  {
    key: 'complexityThreshold',
    validate: (value: number) => {
      if (typeof value !== 'number' || value < 1 || value > 100) {
        return 'Complexity threshold must be a number between 1 and 100';
      }
      return true;
    },
    sanitize: (value: any) => Math.max(1, Math.min(100, Number(value)))
  },
  {
    key: 'maxDepth',
    validate: (value: number) => {
      if (typeof value !== 'number' || value < 1 || value > 10) {
        return 'Max depth must be a number between 1 and 10';
      }
      return true;
    },
    sanitize: (value: any) => Math.max(1, Math.min(10, Number(value)))
  },
  {
    key: 'breakdownMaxDepth',
    validate: (value: number) => {
      if (typeof value !== 'number' || value < 1 || value > 5) {
        return 'Breakdown max depth must be a number between 1 and 5';
      }
      return true;
    },
    sanitize: (value: any) => Math.max(1, Math.min(5, Number(value)))
  },
  {
    key: 'scanMode',
    validate: (value: string) => {
      if (!['webhook', 'full'].includes(value)) {
        return 'Scan mode must be either "webhook" or "full"';
      }
      return true;
    },
    sanitize: (value: any) => String(value).toLowerCase()
  },
  {
    key: 'actionMode',
    validate: (value: string) => {
      if (!['generate', 'breakdown', 'watcher', 'full'].includes(value)) {
        return 'Action mode must be one of: generate, breakdown, watcher, full';
      }
      return true;
    },
    sanitize: (value: any) => String(value).toLowerCase()
  },
  {
    key: 'prdPathGlob',
    validate: (value: string) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'PRD path glob must be a non-empty string';
      }
      return true;
    },
    sanitize: (value: any) => String(value).trim()
  },
  {
    key: 'taskmasterVersion',
    validate: (value: string) => {
      if (typeof value !== 'string' || !/^\d+\.\d+\.\d+/.test(value)) {
        return 'Taskmaster version must be a valid semantic version (e.g., "1.0.0")';
      }
      return true;
    },
    sanitize: (value: any) => String(value).trim()
  },
  {
    key: 'taskmasterBaseUrl',
    validate: (value: string) => {
      if (typeof value !== 'string' || !value.startsWith('http')) {
        return 'Taskmaster base URL must be a valid HTTP/HTTPS URL';
      }
      return true;
    },
    sanitize: (value: any) => String(value).trim().replace(/\/$/, '')
  },
  {
    key: 'githubToken',
    validate: (value: string) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'GitHub token is required and must be a non-empty string';
      }
      return true;
    },
    sanitize: (value: any) => String(value).trim()
  },
  {
    key: 'outputFormat',
    validate: (value: string) => {
      if (!['json', 'xml', 'text', 'auto'].includes(value)) {
        return 'Output format must be one of: json, xml, text, auto';
      }
      return true;
    },
    sanitize: (value: any) => String(value).toLowerCase()
  },
  {
    key: 'outputSanitize',
    validate: (value: boolean) => {
      if (typeof value !== 'boolean') {
        return 'Output sanitize must be a boolean value';
      }
      return true;
    },
    sanitize: (value: any) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        return lower === 'true' || lower === '1' || lower === 'yes';
      }
      return Boolean(value);
    }
  },
  {
    key: 'outputMaxSize',
    validate: (value: number) => {
      if (typeof value !== 'number' || value < 1 || value > 10485760) { // 10MB max
        return 'Output max size must be a number between 1 and 10485760 bytes (10MB)';
      }
      return true;
    },
    sanitize: (value: any) => Math.max(1, Math.min(10485760, Number(value)))
  }
];

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    key: string;
    message: string;
    value: any;
  }>;
  sanitized: Partial<TaskmasterConfig>;
}

/**
 * Validate and sanitize configuration
 */
export function validateConfig(config: Partial<TaskmasterConfig>, options: { skipRequired?: boolean } = {}): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    sanitized: {}
  };

  for (const rule of VALIDATION_RULES) {
    const value = config[rule.key];
    
    if (value !== undefined) {
      // Sanitize first if sanitizer exists
      const sanitizedValue = rule.sanitize ? rule.sanitize(value) : value;
      result.sanitized[rule.key] = sanitizedValue;
      
      // Then validate
      const validationResult = rule.validate(sanitizedValue);
      if (validationResult !== true) {
        result.valid = false;
        result.errors.push({
          key: rule.key,
          message: typeof validationResult === 'string' ? validationResult : `Invalid value for ${rule.key}`,
          value: sanitizedValue
        });
      }
    } else if (rule.key === 'githubToken' && !options.skipRequired) {
      // GitHub token is required unless we're in test mode
      result.valid = false;
      result.errors.push({
        key: rule.key,
        message: 'GitHub token is required and must be a non-empty string',
        value: undefined
      });
    }
  }

  return result;
}

/**
 * Load configuration from environment variables
 * Follows GitHub Actions convention: INPUT_<NAME> or TM_<NAME>
 */
export function loadFromEnvironment(): Partial<TaskmasterConfig> {
  const config: Partial<TaskmasterConfig> = {};
  
  const envMappings: Array<[keyof TaskmasterConfig, string[]]> = [
    ['complexityThreshold', ['INPUT_COMPLEXITY-THRESHOLD', 'INPUT_COMPLEXITY_THRESHOLD', 'TM_COMPLEXITY_THRESHOLD']],
    ['maxDepth', ['INPUT_MAX-DEPTH', 'INPUT_MAX_DEPTH', 'TM_MAX_DEPTH']],
    ['prdPathGlob', ['INPUT_PRD-PATH-GLOB', 'INPUT_PRD_PATH_GLOB', 'TM_PRD_PATH_GLOB']],
    ['breakdownMaxDepth', ['INPUT_BREAKDOWN-MAX-DEPTH', 'INPUT_BREAKDOWN_MAX_DEPTH', 'TM_BREAKDOWN_MAX_DEPTH']],
    ['scanMode', ['INPUT_SCAN-MODE', 'INPUT_SCAN_MODE', 'TM_SCAN_MODE']],
    ['taskmasterVersion', ['INPUT_TASKMASTER-VERSION', 'INPUT_TASKMASTER_VERSION', 'TM_TASKMASTER_VERSION']],
    ['taskmasterBaseUrl', ['INPUT_TASKMASTER-BASE-URL', 'INPUT_TASKMASTER_BASE_URL', 'TM_TASKMASTER_BASE_URL']],
    ['taskmasterArgs', ['INPUT_TASKMASTER-ARGS', 'INPUT_TASKMASTER_ARGS', 'TM_TASKMASTER_ARGS']],
    ['forceDownload', ['INPUT_FORCE-DOWNLOAD', 'INPUT_FORCE_DOWNLOAD', 'TM_FORCE_DOWNLOAD']],
    ['githubToken', ['INPUT_GITHUB-TOKEN', 'INPUT_GITHUB_TOKEN', 'TM_GITHUB_TOKEN', 'GITHUB_TOKEN']],
    ['actionMode', ['INPUT_ACTION-MODE', 'INPUT_ACTION_MODE', 'TM_ACTION_MODE']],
    ['outputFormat', ['INPUT_OUTPUT-FORMAT', 'INPUT_OUTPUT_FORMAT', 'TM_OUTPUT_FORMAT']],
    ['outputSanitize', ['INPUT_OUTPUT-SANITIZE', 'INPUT_OUTPUT_SANITIZE', 'TM_OUTPUT_SANITIZE']],
    ['outputMaxSize', ['INPUT_OUTPUT-MAX-SIZE', 'INPUT_OUTPUT_MAX_SIZE', 'TM_OUTPUT_MAX_SIZE']]
  ];

  for (const [configKey, envKeys] of envMappings) {
    for (const envKey of envKeys) {
      const value = process.env[envKey];
      if (value !== undefined) {
        // Convert string values to appropriate types
        if (configKey === 'complexityThreshold' || configKey === 'maxDepth' || configKey === 'breakdownMaxDepth') {
          config[configKey] = parseInt(value, 10);
        } else if (configKey === 'forceDownload') {
          config[configKey] = value.toLowerCase() === 'true';
        } else {
          (config as any)[configKey] = value;
        }
        break; // Use first found value
      }
    }
  }

  return config;
}

/**
 * Load configuration from file (JSON or YAML)
 */
export function loadFromFile(filePath: string): Partial<TaskmasterConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    let configFile: ConfigFile;
    if (ext === '.json') {
      configFile = JSON.parse(content);
    } else if (ext === '.yml' || ext === '.yaml') {
      // Simple YAML parsing for basic key-value pairs
      // For production use, consider using a proper YAML library like 'js-yaml'
      configFile = parseSimpleYaml(content);
    } else {
      throw new Error(`Unsupported config file format: ${ext}`);
    }

    return configFile.taskmaster || {};
  } catch (error) {
    throw new Error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Simple YAML parser for basic key-value configuration
 * Note: This is a simplified parser. For complex YAML, use a proper library.
 */
function parseSimpleYaml(content: string): ConfigFile {
  const lines = content.split('\n');
  const config: any = {};
  let currentSection: any = config;
  let currentKey = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.endsWith(':')) {
      // Section header
      currentKey = trimmed.slice(0, -1);
      currentSection[currentKey] = {};
      currentSection = currentSection[currentKey];
    } else if (trimmed.includes(':')) {
      // Key-value pair
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      
      // Parse value type
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);
      else if (value.startsWith('"') && value.endsWith('"')) {
        parsedValue = value.slice(1, -1);
      }
      
      currentSection[key.trim()] = parsedValue;
    }
  }

  return config;
}

/**
 * Find configuration files in common locations
 */
export function findConfigFiles(baseDir: string = process.cwd()): string[] {
  const configFiles: string[] = [];
  const possibleFiles = [
    '.taskmaster.json',
    '.taskmaster.yml',
    '.taskmaster.yaml',
    'taskmaster.config.json',
    'taskmaster.config.yml',
    'taskmaster.config.yaml'
  ];

  for (const fileName of possibleFiles) {
    const filePath = path.join(baseDir, fileName);
    if (fs.existsSync(filePath)) {
      configFiles.push(filePath);
    }
  }

  return configFiles;
}

/**
 * Load complete configuration with priority order:
 * 1. Default values (lowest priority)
 * 2. Configuration files  
 * 3. Environment variables
 * 4. Direct overrides (highest priority)
 */
export function loadConfig(options: ConfigLoadOptions = {}, overrides: Partial<TaskmasterConfig> = {}): TaskmasterConfig {
  const { baseDir = process.cwd(), environment, configPaths, validate = true } = options;
  
  // Start with defaults
  let config: TaskmasterConfig = { ...DEFAULT_CONFIG };
  
  // Load from configuration files
  const filesToLoad = configPaths || findConfigFiles(baseDir);
  for (const filePath of filesToLoad) {
    try {
      const fileConfig = loadFromFile(filePath);
      config = { ...config, ...fileConfig };
    } catch (error) {
      // Log warning but continue
      console.warn(`Warning: Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Load from environment variables
  const envConfig = loadFromEnvironment();
  config = { ...config, ...envConfig };
  
  // Apply direct overrides
  config = { ...config, ...overrides };
  
  // Validate if requested
  if (validate) {
    const validation = validateConfig(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.key}: ${e.message}`).join(', ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }
    // Use sanitized values
    config = { ...config, ...validation.sanitized };
  }
  
  return config;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<TaskmasterConfig>, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  let content: string;
  
  if (ext === '.json') {
    content = JSON.stringify({ taskmaster: config }, null, 2);
  } else if (ext === '.yml' || ext === '.yaml') {
    content = generateSimpleYaml({ taskmaster: config });
  } else {
    throw new Error(`Unsupported config file format: ${ext}`);
  }
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Simple YAML generator for configuration files
 */
function generateSimpleYaml(obj: any, indent = 0): string {
  const indentStr = '  '.repeat(indent);
  let yaml = '';
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      yaml += `${indentStr}${key}:\n`;
      yaml += generateSimpleYaml(value, indent + 1);
    } else {
      const valueStr = typeof value === 'string' ? `"${value}"` : String(value);
      yaml += `${indentStr}${key}: ${valueStr}\n`;
    }
  }
  
  return yaml;
}

/**
 * Get configuration value with fallback chain
 */
export function getConfigValue<K extends keyof TaskmasterConfig>(
  config: Partial<TaskmasterConfig>,
  key: K,
  fallback?: TaskmasterConfig[K]
): TaskmasterConfig[K] {
  return config[key] !== undefined ? config[key]! : (fallback !== undefined ? fallback : DEFAULT_CONFIG[key]);
}

/**
 * Create a configuration preset for common scenarios
 */
export function createPreset(name: 'development' | 'production' | 'testing'): Partial<TaskmasterConfig> {
  switch (name) {
    case 'development':
      return {
        complexityThreshold: 30,
        maxDepth: 2,
        scanMode: 'full',
        forceDownload: true
      };
    case 'production':
      return {
        complexityThreshold: 40,
        maxDepth: 3,
        scanMode: 'webhook',
        forceDownload: false
      };
    case 'testing':
      return {
        complexityThreshold: 20,
        maxDepth: 1,
        scanMode: 'webhook',
        forceDownload: true
      };
    default:
      return {};
  }
}