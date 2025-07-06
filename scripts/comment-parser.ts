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
      
      // Special handling for empty quoted values in the original command line
      // Check if the original had quotes around an empty value
      const flagPattern = new RegExp(`--${flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=["']?["']`, 'i');
      const hasEmptyQuotedValue = flagPattern.test(commandLine);
      
      if (hasEmptyQuotedValue && value === '') {
        errors.push('Quoted strings cannot be empty');
        args[normalizeKey(flag)] = '';
      } else {
        args[normalizeKey(flag)] = parseValue(value, errors);
      }
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
 * Parse argument value to appropriate type with enhanced validation
 */
function parseValue(value: string, errors: string[]): string | number | boolean {
  // Check for quotes first, before any trimming or empty checks
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    const unquotedValue = value.slice(1, -1);
    // Validate that quoted strings are not empty
    if (unquotedValue.trim() === '') {
      errors.push('Quoted strings cannot be empty');
      return '';
    }
    return unquotedValue;
  }
  
  const trimmedValue = value.trim();
  
  // Handle empty or whitespace-only values (after quote check)
  if (!value || trimmedValue === '') {
    errors.push('Empty argument values are not allowed');
    return value;
  }
  
  // Try to parse as integer
  if (/^-?\d+$/.test(trimmedValue)) {
    const num = parseInt(trimmedValue, 10);
    if (!isNaN(num)) {
      // Check for extremely large numbers that might cause issues
      if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
        errors.push(`Number ${num} is outside safe integer range`);
      }
      return num;
    }
  }
  
  // Try to parse as float - be more strict about the format
  if (/^-?\d+\.\d+$/.test(trimmedValue)) {
    const num = parseFloat(trimmedValue);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  
  // Check for invalid decimal attempts
  if (trimmedValue.includes('.') && !/^-?\d+\.\d+$/.test(trimmedValue)) {
    errors.push(`Invalid decimal number: ${trimmedValue}`);
    return trimmedValue;
  }
  
  // Try to parse as boolean
  const lowerValue = trimmedValue.toLowerCase();
  if (lowerValue === 'true') return true;
  if (lowerValue === 'false') return false;
  
  // Check for common boolean-like values and provide helpful error messages
  if (['yes', 'no', '1', '0', 'on', 'off'].includes(lowerValue)) {
    errors.push(`Use 'true' or 'false' for boolean values, not '${trimmedValue}'`);
  }
  
  return trimmedValue;
}

/**
 * Enhanced validation configuration for command arguments
 */
interface ValidationRule {
  type: 'number' | 'string' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
  allowedValues?: readonly (string | number | boolean)[];
  description?: string;
}

interface ValidationConfig {
  [key: string]: ValidationRule;
}

/**
 * Validation configuration for breakdown command arguments
 */
const BREAKDOWN_VALIDATION_CONFIG: ValidationConfig = {
  maxDepth: {
    type: 'number',
    min: 1,
    max: 5,
    description: 'Maximum depth for task breakdown (1-5)'
  },
  depth: {
    type: 'number',
    min: 1,
    max: 5,
    description: 'Depth for task breakdown (1-5)'
  },
  complexityThreshold: {
    type: 'number',
    min: 1,
    max: 100,
    description: 'Complexity threshold for task breakdown (1-100)'
  },
  threshold: {
    type: 'number',
    min: 1,
    max: 100,
    description: 'Complexity threshold for task breakdown (1-100)'
  },
  complexity: {
    type: 'number',
    min: 1,
    max: 100,
    description: 'Complexity threshold for task breakdown (1-100)'
  }
} as const;

/**
 * Validate a single argument against its validation rule
 */
function validateArgument(
  key: string, 
  value: any, 
  rule: ValidationRule,
  originalKey?: string
): string[] {
  const errors: string[] = [];
  const displayKey = originalKey || key;
  
  // Type validation
  if (typeof value !== rule.type) {
    const expectedType = rule.type === 'number' ? 'a number' : 
                        rule.type === 'boolean' ? 'true or false' : 'a string';
    errors.push(`Argument '${displayKey}' must be ${expectedType}, got ${typeof value} (${value})`);
    return errors; // Return early if type is wrong
  }
  
  // Range validation for numbers
  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      const desc = rule.description || `${displayKey} value`;
      errors.push(`${desc}: ${value} is below minimum allowed value of ${rule.min}`);
    }
    if (rule.max !== undefined && value > rule.max) {
      const desc = rule.description || `${displayKey} value`;
      errors.push(`${desc}: ${value} exceeds maximum allowed value of ${rule.max}`);
    }
    
    // Check for non-integer values where integers are expected
    if (key.includes('depth') || key.includes('Depth')) {
      if (!Number.isInteger(value)) {
        errors.push(`Argument '${displayKey}' must be a whole number, got ${value}`);
      }
    }
  }
  
  // Allowed values validation
  if (rule.allowedValues && !rule.allowedValues.includes(value)) {
    errors.push(`Argument '${displayKey}' must be one of: ${rule.allowedValues.join(', ')}, got ${value}`);
  }
  
  return errors;
}

/**
 * Enhanced validation for breakdown command arguments
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
  
  // Track original keys for better error messages
  const keyMappings: { [normalizedKey: string]: string } = {};
  
  // Normalize argument names and track original keys
  const argEntries = Object.entries(args);
  for (const [originalKey, value] of argEntries) {
    const normalizedKey = normalizeKey(originalKey);
    normalized[normalizedKey] = value;
    keyMappings[normalizedKey] = originalKey;
  }
  
  // Validate each known argument
  for (const [normalizedKey, rule] of Object.entries(BREAKDOWN_VALIDATION_CONFIG)) {
    if (normalizedKey in normalized) {
      const value = normalized[normalizedKey];
      const originalKey = keyMappings[normalizedKey];
      const argErrors = validateArgument(normalizedKey, value, rule, originalKey);
      errors.push(...argErrors);
    }
  }
  
  // Check for unknown arguments with helpful suggestions
  const knownKeys = Object.keys(BREAKDOWN_VALIDATION_CONFIG);
  for (const originalKey of Object.keys(args)) {
    const normalizedKey = normalizeKey(originalKey);
    if (!knownKeys.includes(normalizedKey)) {
      // Provide suggestions for similar argument names using improved similarity matching
      const suggestions = knownKeys.filter(knownKey => {
        const lowerNormalized = normalizedKey.toLowerCase();
        const lowerKnown = knownKey.toLowerCase();
        
        // Skip if they're identical
        if (lowerNormalized === lowerKnown) {
          return false;
        }
        
        // Handle underscore to camelCase conversion more intelligently
        const underscoreConverted = originalKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (underscoreConverted.toLowerCase() === lowerKnown) {
          return true;
        }
        
        // Check for substring match (partial match)
        if (lowerKnown.includes(lowerNormalized) || lowerNormalized.includes(lowerKnown)) {
          return true;
        }
        
        // Better single character difference detection (for typos like 'treshold' -> 'threshold')
        if (Math.abs(lowerNormalized.length - lowerKnown.length) <= 1) {
          const levenshteinDistance = calculateLevenshteinDistance(lowerNormalized, lowerKnown);
          if (levenshteinDistance <= 1) {
            return true;
          }
        }
        
        // Check for similar length with 2 character differences (common typos)
        if (Math.abs(lowerNormalized.length - lowerKnown.length) <= 2 && 
            Math.min(lowerNormalized.length, lowerKnown.length) >= 4) {
          const levenshteinDistance = calculateLevenshteinDistance(lowerNormalized, lowerKnown);
          if (levenshteinDistance <= 2) {
            return true;
          }
        }
        
        return false;
      });
      
      let errorMsg = `Unknown argument: '${originalKey}'`;
      if (suggestions.length > 0) {
        if (suggestions.length === 1) {
          errorMsg += `. Did you mean: ${suggestions[0]}?`;
        } else {
          errorMsg += `. Did you mean: ${suggestions.join(', ')}?`;
        }
      } else {
        errorMsg += `. Valid arguments are: ${knownKeys.join(', ')}`;
      }
      errors.push(errorMsg);
    }
  }
  
  // Check for conflicting arguments
  const depthArgs = ['maxDepth', 'depth'].filter(key => key in normalized);
  if (depthArgs.length > 1) {
    const originalKeys = depthArgs.map(key => keyMappings[key]).join(', ');
    errors.push(`Cannot specify multiple depth arguments: ${originalKeys}. Use only one.`);
  }
  
  const thresholdArgs = ['complexityThreshold', 'threshold', 'complexity'].filter(key => key in normalized);
  if (thresholdArgs.length > 1) {
    const originalKeys = thresholdArgs.map(key => keyMappings[key]).join(', ');
    errors.push(`Cannot specify multiple threshold arguments: ${originalKeys}. Use only one.`);
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

/**
 * Calculate Levenshtein distance between two strings for better typo detection
 */
function calculateLevenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[a.length][b.length];
}