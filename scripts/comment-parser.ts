/**
 * Comment Parser
 * 
 * Parses issue comments to identify valid commands, extract parameters, and handle 
 * different comment formats and edge cases.
 */

// Interfaces for parsed comment data
export interface ParsedCommand {
  command: string;
  args: CommandArguments;
  rawText: string;
  isValid: boolean;
  errors: string[];
}

export interface CommandArguments {
  [key: string]: string | number | boolean;
}

export interface CommentParseOptions {
  supportedCommands?: string[];
  caseSensitive?: boolean;
  allowMultipleCommands?: boolean;
}

// Default supported commands
const DEFAULT_SUPPORTED_COMMANDS = ['breakdown'];

/**
 * Check if a comment contains a valid command
 */
export function containsCommand(
  commentBody: string, 
  options: CommentParseOptions = {}
): boolean {
  const { supportedCommands = DEFAULT_SUPPORTED_COMMANDS, caseSensitive = false } = options;
  
  const normalizedBody = caseSensitive ? commentBody : commentBody.toLowerCase();
  
  return supportedCommands.some(cmd => {
    const normalizedCmd = caseSensitive ? cmd : cmd.toLowerCase();
    const commandPattern = new RegExp(`^\\s*/${normalizedCmd}(?:\\s|$)`, 'm');
    return commandPattern.test(normalizedBody);
  });
}

/**
 * Parse a command from a comment body
 */
export function parseCommand(
  commentBody: string, 
  options: CommentParseOptions = {}
): ParsedCommand | null {
  const { 
    supportedCommands = DEFAULT_SUPPORTED_COMMANDS, 
    caseSensitive = false,
    allowMultipleCommands = false
  } = options;
  
  const errors: string[] = [];
  
  // Find command lines
  const lines = commentBody.split('\n');
  let commandLine: string | null = null;
  let commandMatch: string | null = null;
  let commandCount = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('/')) continue;
    
    for (const cmd of supportedCommands) {
      const normalizedLine = caseSensitive ? trimmedLine : trimmedLine.toLowerCase();
      const normalizedCmd = caseSensitive ? cmd : cmd.toLowerCase();
      
      if (normalizedLine.startsWith(`/${normalizedCmd}`)) {
        commandCount++;
        if (commandCount === 1) {
          commandLine = trimmedLine;
          commandMatch = cmd;
        }
        break;
      }
    }
  }
  
  if (!commandLine || !commandMatch) {
    return null;
  }
  
  // Check for multiple commands
  if (commandCount > 1 && !allowMultipleCommands) {
    errors.push(`Multiple commands found, only one command per comment is allowed`);
  }
  
  // Parse arguments from the command line
  const args = parseCommandArguments(commandLine, commandMatch, errors);
  
  return {
    command: commandMatch,
    args,
    rawText: commandLine,
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Parse command arguments from a command line
 * Supports formats like:
 * - /breakdown --depth 3 --threshold 50
 * - /breakdown max-depth=2 complexity=30
 * - /breakdown --depth=3 threshold=50
 */
function parseCommandArguments(
  commandLine: string, 
  command: string, 
  errors: string[]
): CommandArguments {
  const args: CommandArguments = {};
  
  // Remove the command part
  const argsString = commandLine.replace(new RegExp(`^\\s*/${command}\\s*`), '').trim();
  
  if (!argsString) {
    return args;
  }
  
  // Split by spaces, but handle quoted values
  const tokens = parseTokens(argsString);
  
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    
    // Handle --flag=value format
    if (token.startsWith('--') && token.includes('=')) {
      const [flag, ...valueParts] = token.substring(2).split('=');
      const value = valueParts.join('=');
      args[normalizeKey(flag)] = parseValue(value, errors);
      i++;
      continue;
    }
    
    // Handle key=value format
    if (token.includes('=') && !token.startsWith('--')) {
      const [key, ...valueParts] = token.split('=');
      const value = valueParts.join('=');
      args[normalizeKey(key)] = parseValue(value, errors);
      i++;
      continue;
    }
    
    // Handle --flag value format
    if (token.startsWith('--')) {
      const flag = token.substring(2);
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        args[normalizeKey(flag)] = parseValue(tokens[i + 1], errors);
        i += 2;
        continue;
      } else {
        // Boolean flag
        args[normalizeKey(flag)] = true;
        i++;
        continue;
      }
    }
    
    // Handle single argument (treat as boolean or unknown)
    if (!token.startsWith('-')) {
      errors.push(`Unexpected argument: ${token}`);
    } else {
      errors.push(`Invalid flag format: ${token}`);
    }
    i++;
  }
  
  return args;
}

/**
 * Parse tokens from argument string, handling quoted values
 */
function parseTokens(argsString: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }
    
    if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
      continue;
    }
    
    if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    
    current += char;
  }
  
  if (current) {
    tokens.push(current);
  }
  
  return tokens;
}

/**
 * Normalize argument key (convert kebab-case to camelCase)
 */
function normalizeKey(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parse argument value to appropriate type
 */
function parseValue(value: string, errors: string[]): string | number | boolean {
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // Try to parse as number
  if (/^\d+$/.test(value)) {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      return num;
    }
  }
  
  // Try to parse as float
  if (/^\d+\.\d+$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num;
    }
  }
  
  // Try to parse as boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  return value;
}

/**
 * Validate breakdown command arguments
 */
export function validateBreakdownArgs(args: CommandArguments): { 
  isValid: boolean; 
  errors: string[];
  normalized: {
    maxDepth?: number;
    complexityThreshold?: number;
    depth?: number;
    threshold?: number;
    complexity?: number;
  };
} {
  const errors: string[] = [];
  const normalized: any = {};
  
  // Normalize argument names
  if ('maxDepth' in args) normalized.maxDepth = args.maxDepth;
  if ('max-depth' in args) normalized.maxDepth = args['max-depth'];
  if ('depth' in args) normalized.depth = args.depth;
  
  if ('complexityThreshold' in args) normalized.complexityThreshold = args.complexityThreshold;
  if ('complexity-threshold' in args) normalized.complexityThreshold = args['complexity-threshold'];
  if ('threshold' in args) normalized.threshold = args.threshold;
  if ('complexity' in args) normalized.complexity = args.complexity;
  
  // Validate depth arguments
  for (const key of ['maxDepth', 'depth']) {
    if (key in normalized) {
      const value = normalized[key];
      if (typeof value !== 'number' || value < 1 || value > 5) {
        errors.push(`${key} must be a number between 1 and 5, got: ${value}`);
      }
    }
  }
  
  // Validate threshold/complexity arguments
  for (const key of ['complexityThreshold', 'threshold', 'complexity']) {
    if (key in normalized) {
      const value = normalized[key];
      if (typeof value !== 'number' || value < 1 || value > 100) {
        errors.push(`${key} must be a number between 1 and 100, got: ${value}`);
      }
    }
  }
  
  // Check for unknown arguments
  for (const key of Object.keys(args)) {
    const normalizedKey = normalizeKey(key);
    if (!['maxDepth', 'depth', 'complexityThreshold', 'threshold', 'complexity'].includes(normalizedKey)) {
      errors.push(`Unknown argument: ${key}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized
  };
}

/**
 * Parse breakdown command from comment
 */
export function parseBreakdownCommand(commentBody: string): {
  found: boolean;
  command?: ParsedCommand;
  validation?: ReturnType<typeof validateBreakdownArgs>;
} {
  const command = parseCommand(commentBody, { supportedCommands: ['breakdown'] });
  
  if (!command) {
    return { found: false };
  }
  
  const validation = validateBreakdownArgs(command.args);
  
  return {
    found: true,
    command: {
      ...command,
      isValid: command.isValid && validation.isValid,
      errors: [...command.errors, ...validation.errors]
    },
    validation
  };
}