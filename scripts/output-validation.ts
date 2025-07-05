/**
 * Output Format Validation Module
 * 
 * Provides comprehensive output format validation with support for:
 * - JSON format parsing and validation
 * - XML format parsing and validation
 * - Plain text format validation
 * - Format conversion between supported formats
 * - Error handling for malformed output
 * - Output sanitization and validation rules
 * - Task graph schema validation and data extraction
 */

/**
 * Supported output formats
 */
export type OutputFormat = 'json' | 'xml' | 'text';

/**
 * Task interface matching the expected Taskmaster output structure
 */
export interface Task {
  id: number;
  title: string;
  description: string;
  details?: string;
  testStrategy?: string;
  priority?: string;
  dependencies?: number[];
  status?: string;
  subtasks?: Task[];
  // Added by processing logic
  requiredBy?: Task[];
}

/**
 * Task graph schema for Taskmaster CLI output
 */
export interface TaskGraph {
  /** Array of root tasks */
  tasks: Task[];
  /** Metadata about the task generation */
  metadata: {
    version?: string;
    generatedAt?: string;
    source?: string;
    complexity?: number;
    totalTasks?: number;
    [key: string]: any;
  };
}

/**
 * GitHub API compatible task data
 */
export interface GitHubTaskData {
  /** GitHub issue title */
  title: string;
  /** GitHub issue body content */
  body: string;
  /** Labels to apply to the issue */
  labels: string[];
  /** Assignees for the issue */
  assignees?: string[];
  /** Milestone to assign */
  milestone?: number;
  /** Task metadata for tracking */
  metadata: {
    taskId: number;
    parentTaskId?: number;
    complexity?: number;
    dependencies: number[];
    subtaskIds: number[];
    [key: string]: any;
  };
}

/**
 * Validation result for output format parsing
 */
export interface OutputValidationResult {
  /** Whether the output is valid */
  valid: boolean;
  /** Detected format (if any) */
  format?: OutputFormat;
  /** Parsed data (if successful) */
  data?: any;
  /** Validation errors */
  errors: string[];
  /** Sanitized output (if applicable) */
  sanitized?: string;
}

/**
 * Options for output validation
 */
export interface OutputValidationOptions {
  /** Expected format (for strict validation) */
  expectedFormat?: OutputFormat;
  /** Whether to attempt format detection */
  autoDetect?: boolean;
  /** Whether to sanitize the output */
  sanitize?: boolean;
  /** Maximum output size in bytes */
  maxSize?: number;
  /** Whether to allow empty output */
  allowEmpty?: boolean;
}

/**
 * Options for format conversion
 */
export interface FormatConversionOptions {
  /** Source format */
  from: OutputFormat;
  /** Target format */
  to: OutputFormat;
  /** Pretty formatting for output */
  pretty?: boolean;
  /** Custom root element name for XML conversion */
  rootElement?: string;
}

/**
 * Result of format conversion
 */
export interface ConversionResult {
  /** Whether conversion was successful */
  success: boolean;
  /** Converted output */
  output?: string;
  /** Conversion errors */
  errors: string[];
}

/**
 * Detect the format of given output
 */
export function detectOutputFormat(output: string): OutputFormat | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  const trimmed = output.trim();
  if (!trimmed) {
    return 'text'; // Empty content is considered text
  }

  // Try JSON first
  try {
    JSON.parse(trimmed);
    return 'json';
  } catch {
    // Not JSON, continue checking
  }

  // Check for XML
  if (trimmed.startsWith('<?xml') || 
      (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.includes('</'))) {
    return 'xml';
  }

  // Default to plain text
  return 'text';
}

/**
 * Parse JSON output with validation
 */
export function parseJsonOutput(output: string): { data?: any; errors: string[] } {
  const errors: string[] = [];
  
  try {
    if (!output || typeof output !== 'string') {
      errors.push('Output must be a non-empty string');
      return { errors };
    }

    const trimmed = output.trim();
    if (!trimmed) {
      errors.push('JSON output cannot be empty');
      return { errors };
    }

    const data = JSON.parse(trimmed);
    return { data, errors: [] };
  } catch (error) {
    errors.push(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return { errors };
  }
}

/**
 * Validate task graph schema
 */
export function validateTaskGraphSchema(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Task graph must be a valid object');
    return { valid: false, errors };
  }

  // Check for required top-level properties
  if (!Array.isArray(data.tasks)) {
    errors.push('Task graph must have a "tasks" array');
  }

  if (!data.metadata || typeof data.metadata !== 'object') {
    errors.push('Task graph must have a "metadata" object');
  }

  // Validate tasks array
  if (Array.isArray(data.tasks)) {
    data.tasks.forEach((task: any, index: number) => {
      const taskErrors = validateTaskSchema(task, `tasks[${index}]`);
      errors.push(...taskErrors);
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate individual task schema
 */
function validateTaskSchema(task: any, path: string): string[] {
  const errors: string[] = [];

  if (!task || typeof task !== 'object') {
    errors.push(`${path}: Task must be an object`);
    return errors;
  }

  // Required fields
  if (typeof task.id !== 'number') {
    errors.push(`${path}: Task must have a numeric "id"`);
  }

  if (!task.title || typeof task.title !== 'string') {
    errors.push(`${path}: Task must have a string "title"`);
  }

  if (!task.description || typeof task.description !== 'string') {
    errors.push(`${path}: Task must have a string "description"`);
  }

  // Optional fields validation
  if (task.dependencies && !Array.isArray(task.dependencies)) {
    errors.push(`${path}: dependencies must be an array`);
  } else if (Array.isArray(task.dependencies)) {
    task.dependencies.forEach((dep: any, i: number) => {
      if (typeof dep !== 'number') {
        errors.push(`${path}: dependencies[${i}] must be a number`);
      }
    });
  }

  if (task.subtasks && !Array.isArray(task.subtasks)) {
    errors.push(`${path}: subtasks must be an array`);
  } else if (Array.isArray(task.subtasks)) {
    task.subtasks.forEach((subtask: any, i: number) => {
      const subtaskErrors = validateTaskSchema(subtask, `${path}.subtasks[${i}]`);
      errors.push(...subtaskErrors);
    });
  }

  return errors;
}

/**
 * Parse and validate task graph JSON with enhanced error handling
 */
export function parseTaskGraphJson(output: string): { 
  data?: TaskGraph; 
  errors: string[]; 
  parseErrors: string[];
  validationErrors: string[];
} {
  const parseErrors: string[] = [];
  const validationErrors: string[] = [];
  const allErrors: string[] = [];

  try {
    // First, attempt basic JSON parsing
    const parseResult = parseJsonOutput(output);
    
    if (parseResult.errors.length > 0) {
      parseErrors.push(...parseResult.errors);
      allErrors.push(...parseResult.errors);
      return { 
        errors: allErrors, 
        parseErrors, 
        validationErrors 
      };
    }

    const parsedData = parseResult.data;

    // Then validate against task graph schema
    const validationResult = validateTaskGraphSchema(parsedData);
    
    if (!validationResult.valid) {
      validationErrors.push(...validationResult.errors);
      allErrors.push(...validationResult.errors);
      return { 
        errors: allErrors, 
        parseErrors, 
        validationErrors 
      };
    }

    // If validation passes, return the data as TaskGraph
    return {
      data: parsedData as TaskGraph,
      errors: [],
      parseErrors: [],
      validationErrors: []
    };

  } catch (error) {
    const errorMessage = `Unexpected error during task graph parsing: ${error instanceof Error ? error.message : String(error)}`;
    parseErrors.push(errorMessage);
    allErrors.push(errorMessage);
    return { 
      errors: allErrors, 
      parseErrors, 
      validationErrors 
    };
  }
}

/**
 * Extract tasks for GitHub API consumption
 */
export function extractTasksForGitHub(taskGraph: TaskGraph): {
  tasks: GitHubTaskData[];
  errors: string[];
} {
  const tasks: GitHubTaskData[] = [];
  const errors: string[] = [];

  try {
    if (!taskGraph.tasks || !Array.isArray(taskGraph.tasks)) {
      errors.push('Task graph must contain a tasks array');
      return { tasks, errors };
    }

    // Process each root task
    taskGraph.tasks.forEach((task, index) => {
      try {
        const githubTask = convertTaskToGitHubData(task);
        tasks.push(githubTask);

        // Process subtasks if they exist
        if (task.subtasks && Array.isArray(task.subtasks)) {
          task.subtasks.forEach((subtask) => {
            try {
              const githubSubtask = convertTaskToGitHubData(subtask, task.id);
              tasks.push(githubSubtask);
            } catch (error) {
              errors.push(`Failed to convert subtask ${subtask.id} of task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
          });
        }
      } catch (error) {
        errors.push(`Failed to convert task ${index}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return { tasks, errors };
  } catch (error) {
    errors.push(`Failed to extract tasks: ${error instanceof Error ? error.message : String(error)}`);
    return { tasks, errors };
  }
}

/**
 * Convert a task to GitHub API compatible data
 */
function convertTaskToGitHubData(task: Task, parentTaskId?: number): GitHubTaskData {
  // Build issue title
  const title = `[${task.id}] ${task.title}`;

  // Build issue body
  let body = `## Details\n${task.description}`;
  
  if (task.details) {
    body += `\n\n${task.details}`;
  }

  if (task.testStrategy) {
    body += `\n\n## Test Strategy\n${task.testStrategy}`;
  }

  // Add dependencies section
  if (task.dependencies && task.dependencies.length > 0) {
    body += '\n\n## Dependencies\n';
    task.dependencies.forEach(depId => {
      body += `- [ ] #${depId}\n`;
    });
  }

  // Add metadata section
  body += '\n\n## Meta';
  body += `\n- **Status:** \`${task.status || 'pending'}\``;
  
  if (parentTaskId) {
    body += `\n- **Parent Task:** #${parentTaskId}`;
  }

  if (task.priority) {
    body += `\n- **Priority:** \`${task.priority}\``;
  }

  // Determine labels
  const labels = ['taskmaster'];
  if (task.priority) {
    labels.push(`priority:${task.priority}`);
  }
  if (task.status) {
    labels.push(`status:${task.status}`);
  }
  if (parentTaskId) {
    labels.push('subtask');
  }

  // Extract subtask IDs
  const subtaskIds = task.subtasks ? task.subtasks.map(st => st.id) : [];

  return {
    title,
    body,
    labels,
    metadata: {
      taskId: task.id,
      parentTaskId,
      dependencies: task.dependencies || [],
      subtaskIds,
    }
  };
}

/**
 * Calculate task complexity from task graph
 */
export function calculateTaskComplexity(taskGraph: TaskGraph): {
  totalTasks: number;
  maxDepth: number;
  averageSubtasks: number;
  complexityScore: number;
} {
  let totalTasks = 0;
  let maxDepth = 0;
  let totalSubtasks = 0;
  let tasksWithSubtasks = 0;

  function analyzeTask(task: Task, depth: number = 0): void {
    totalTasks++;
    maxDepth = Math.max(maxDepth, depth);

    if (task.subtasks && task.subtasks.length > 0) {
      totalSubtasks += task.subtasks.length;
      tasksWithSubtasks++;
      
      task.subtasks.forEach(subtask => {
        analyzeTask(subtask, depth + 1);
      });
    }
  }

  taskGraph.tasks.forEach(task => analyzeTask(task));

  const averageSubtasks = tasksWithSubtasks > 0 ? totalSubtasks / tasksWithSubtasks : 0;
  const complexityScore = Math.min(10, Math.round(
    (totalTasks * 0.3) + 
    (maxDepth * 2) + 
    (averageSubtasks * 1.5)
  ));

  return {
    totalTasks,
    maxDepth,
    averageSubtasks,
    complexityScore
  };
}

/**
 * Parse XML output with basic validation
 */
export function parseXmlOutput(output: string): { data?: any; errors: string[] } {
  const errors: string[] = [];
  
  try {
    if (!output || typeof output !== 'string') {
      errors.push('Output must be a non-empty string');
      return { errors };
    }

    const trimmed = output.trim();
    if (!trimmed) {
      errors.push('XML output cannot be empty');
      return { errors };
    }

    // Basic XML validation checks
    if (!trimmed.includes('<') || !trimmed.includes('>')) {
      errors.push('Invalid XML: Missing required angle brackets');
      return { errors };
    }

    // Check for basic well-formedness
    const openTags = (trimmed.match(/<[^\/!?][^>]*>/g) || []);
    const closeTags = (trimmed.match(/<\/[^>]+>/g) || []);
    const selfClosingTags = (trimmed.match(/<[^\/!?][^>]*\/>/g) || []);
    
    // Basic tag balance check (not perfect but catches obvious issues)
    if (openTags.length !== closeTags.length + selfClosingTags.length) {
      errors.push('Invalid XML: Unbalanced tags detected');
      return { errors };
    }

    // Return a simple representation for now
    // In a real implementation, you'd use a proper XML parser
    return { 
      data: { 
        xml: trimmed,
        tagCount: openTags.length + selfClosingTags.length
      }, 
      errors: [] 
    };
  } catch (error) {
    errors.push(`Invalid XML: ${error instanceof Error ? error.message : String(error)}`);
    return { errors };
  }
}

/**
 * Validate plain text output
 */
export function parseTextOutput(output: string): { data?: any; errors: string[] } {
  const errors: string[] = [];
  
  if (output === null || output === undefined) {
    errors.push('Output cannot be null or undefined');
    return { errors };
  }

  if (typeof output !== 'string') {
    errors.push('Text output must be a string');
    return { errors };
  }

  // Text is always valid, but we can provide some metadata
  return { 
    data: {
      text: output,
      length: output.length,
      lines: output.split('\n').length,
      isEmpty: output.trim().length === 0
    }, 
    errors: [] 
  };
}

/**
 * Sanitize output by removing potentially harmful content
 */
export function sanitizeOutput(output: string, format: OutputFormat): string {
  if (!output || typeof output !== 'string') {
    return '';
  }

  let sanitized = output;

  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Format-specific sanitization
  switch (format) {
    case 'json':
      // For JSON, ensure we don't have any dangerous JavaScript
      sanitized = sanitized.replace(/javascript:/gi, 'blocked:');
      break;
    
    case 'xml':
      // For XML, escape potentially dangerous entities
      sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');
      break;
    
    case 'text':
      // For text, just the control character removal above is sufficient
      break;
  }

  return sanitized;
}

/**
 * Validate output format with comprehensive checks
 */
export function validateOutput(
  output: string, 
  options: OutputValidationOptions = {}
): OutputValidationResult {
  const result: OutputValidationResult = {
    valid: true,
    errors: []
  };

  // Check size limits
  if (options.maxSize && output && output.length > options.maxSize) {
    result.valid = false;
    result.errors.push(`Output exceeds maximum size of ${options.maxSize} bytes`);
    return result;
  }

  // Check empty output
  if (!options.allowEmpty && (!output || output.trim().length === 0)) {
    result.valid = false;
    result.errors.push('Output cannot be empty');
    return result;
  }

  // Detect or validate format
  const detectedFormat = options.autoDetect !== false ? detectOutputFormat(output) : null;
  const targetFormat = options.expectedFormat || detectedFormat;

  if (!targetFormat) {
    result.valid = false;
    result.errors.push('Could not detect output format');
    return result;
  }

  result.format = targetFormat;

  // Sanitize if requested
  if (options.sanitize) {
    result.sanitized = sanitizeOutput(output, targetFormat);
  }

  // Parse based on format
  let parseResult: { data?: any; errors: string[] };
  
  switch (targetFormat) {
    case 'json':
      parseResult = parseJsonOutput(options.sanitize ? result.sanitized! : output);
      break;
    case 'xml':
      parseResult = parseXmlOutput(options.sanitize ? result.sanitized! : output);
      break;
    case 'text':
      parseResult = parseTextOutput(options.sanitize ? result.sanitized! : output);
      break;
    default:
      result.valid = false;
      result.errors.push(`Unsupported format: ${targetFormat}`);
      return result;
  }

  if (parseResult.errors.length > 0) {
    result.valid = false;
    result.errors.push(...parseResult.errors);
  } else {
    result.data = parseResult.data;
  }

  return result;
}

/**
 * Convert output from one format to another
 */
export function convertFormat(
  output: string, 
  options: FormatConversionOptions
): ConversionResult {
  const result: ConversionResult = {
    success: false,
    errors: []
  };

  try {
    // Parse source format
    let sourceData: any;
    
    switch (options.from) {
      case 'json':
        const jsonParse = parseJsonOutput(output);
        if (jsonParse.errors.length > 0) {
          result.errors.push(...jsonParse.errors);
          return result;
        }
        sourceData = jsonParse.data;
        break;
        
      case 'xml':
        const xmlParse = parseXmlOutput(output);
        if (xmlParse.errors.length > 0) {
          result.errors.push(...xmlParse.errors);
          return result;
        }
        sourceData = xmlParse.data;
        break;
        
      case 'text':
        const textParse = parseTextOutput(output);
        if (textParse.errors.length > 0) {
          result.errors.push(...textParse.errors);
          return result;
        }
        sourceData = textParse.data;
        break;
        
      default:
        result.errors.push(`Unsupported source format: ${options.from}`);
        return result;
    }

    // Convert to target format
    switch (options.to) {
      case 'json':
        if (options.from === 'json') {
          result.output = options.pretty ? 
            JSON.stringify(sourceData, null, 2) : 
            JSON.stringify(sourceData);
        } else if (options.from === 'text') {
          result.output = JSON.stringify({ text: sourceData.text }, null, options.pretty ? 2 : 0);
        } else if (options.from === 'xml') {
          result.output = JSON.stringify({ xml: sourceData.xml }, null, options.pretty ? 2 : 0);
        }
        break;
        
      case 'xml':
        const rootElement = options.rootElement || 'root';
        if (options.from === 'json') {
          result.output = jsonToXml(sourceData, rootElement, options.pretty);
        } else if (options.from === 'text') {
          result.output = `<${rootElement}><![CDATA[${sourceData.text}]]></${rootElement}>`;
        } else if (options.from === 'xml') {
          result.output = sourceData.xml;
        }
        break;
        
      case 'text':
        if (options.from === 'json') {
          result.output = JSON.stringify(sourceData, null, options.pretty ? 2 : 0);
        } else if (options.from === 'xml') {
          result.output = sourceData.xml;
        } else if (options.from === 'text') {
          result.output = sourceData.text;
        }
        break;
        
      default:
        result.errors.push(`Unsupported target format: ${options.to}`);
        return result;
    }

    result.success = true;
    return result;
    
  } catch (error) {
    result.errors.push(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * Simple JSON to XML converter
 */
function jsonToXml(obj: any, rootElement: string = 'root', pretty: boolean = false): string {
  const indent = pretty ? '  ' : '';
  const newline = pretty ? '\n' : '';
  
  function convertValue(value: any, key: string, depth: number = 0): string {
    const currentIndent = pretty ? indent.repeat(depth) : '';
    const nextIndent = pretty ? indent.repeat(depth + 1) : '';
    
    if (value === null || value === undefined) {
      return `${currentIndent}<${key} />${newline}`;
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      let xml = `${currentIndent}<${key}>${newline}`;
      for (const [k, v] of Object.entries(value)) {
        xml += convertValue(v, k, depth + 1);
      }
      xml += `${currentIndent}</${key}>${newline}`;
      return xml;
    }
    
    if (Array.isArray(value)) {
      let xml = '';
      for (const item of value) {
        xml += convertValue(item, 'item', depth);
      }
      return xml;
    }
    
    // Escape XML special characters
    const escaped = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    return `${currentIndent}<${key}>${escaped}</${key}>${newline}`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>${newline}${convertValue(obj, rootElement)}`;
}