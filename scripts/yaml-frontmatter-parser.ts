/**
 * YAML Front-matter Parser for Issue Descriptions
 * 
 * This module provides functionality to parse YAML front-matter from GitHub issue
 * descriptions and extract structured metadata including dependencies, priority,
 * status, and other task-related fields.
 */

import * as yaml from 'js-yaml';

/**
 * Parsed YAML front-matter data structure
 */
export interface ParsedFrontMatter {
  /** Task ID */
  id?: number;
  /** Parent issue number (for subtasks) */
  parent?: number;
  /** Array of dependency task IDs */
  dependencies?: number[];
  /** Task status */
  status?: string;
  /** Task priority */
  priority?: string;
  /** Task complexity score */
  complexity?: number;
  /** Raw YAML content for custom fields */
  raw?: Record<string, any>;
}

/**
 * Parsing result with validation information
 */
export interface FrontMatterParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed front-matter data (if successful) */
  data?: ParsedFrontMatter;
  /** Error message (if parsing failed) */
  error?: string;
  /** Original YAML content that was parsed */
  yamlContent?: string;
  /** Remaining content after front-matter removal */
  content?: string;
}

/**
 * Parse YAML front-matter from issue description
 * 
 * @param issueBody The complete issue body text
 * @returns Parsing result with extracted data
 */
export function parseYamlFrontMatter(issueBody: string): FrontMatterParseResult {
  if (!issueBody || typeof issueBody !== 'string') {
    return {
      success: false,
      error: 'Issue body is empty or invalid',
      content: issueBody || ''
    };
  }

  // Check if the issue body starts with YAML front-matter
  const trimmedBody = issueBody.trim();
  if (!trimmedBody.startsWith('---')) {
    return {
      success: false,
      error: 'No YAML front-matter found (must start with ---)',
      content: issueBody
    };
  }

  // Find the closing --- delimiter
  const lines = trimmedBody.split('\n');
  let endIndex = -1;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return {
      success: false,
      error: 'No closing --- delimiter found for YAML front-matter',
      content: issueBody
    };
  }

  // Extract YAML content and remaining body
  const yamlLines = lines.slice(1, endIndex);
  const yamlContent = yamlLines.join('\n');
  const remainingContent = lines.slice(endIndex + 1).join('\n').trim();

  // Parse YAML content
  try {
    const parsedYaml = yaml.load(yamlContent) as Record<string, any> || {};
    
    // Extract and validate known fields
    const parsedData: ParsedFrontMatter = {
      raw: parsedYaml
    };

    // Parse ID field
    if (parsedYaml.id !== undefined) {
      const id = parseInt(String(parsedYaml.id), 10);
      if (!isNaN(id)) {
        parsedData.id = id;
      }
    }

    // Parse parent field
    if (parsedYaml.parent !== undefined) {
      const parent = parseInt(String(parsedYaml.parent), 10);
      if (!isNaN(parent)) {
        parsedData.parent = parent;
      }
    }

    // Parse dependencies field
    if (parsedYaml.dependencies !== undefined) {
      if (Array.isArray(parsedYaml.dependencies)) {
        const deps = parsedYaml.dependencies
          .map(dep => parseInt(String(dep), 10))
          .filter(dep => !isNaN(dep));
        if (deps.length > 0) {
          parsedData.dependencies = deps;
        }
      }
    }

    // Parse string fields
    if (parsedYaml.status && typeof parsedYaml.status === 'string') {
      parsedData.status = parsedYaml.status.trim();
    }

    if (parsedYaml.priority && typeof parsedYaml.priority === 'string') {
      parsedData.priority = parsedYaml.priority.trim();
    }

    // Parse complexity field
    if (parsedYaml.complexity !== undefined) {
      const complexity = parseFloat(String(parsedYaml.complexity));
      if (!isNaN(complexity)) {
        parsedData.complexity = complexity;
      }
    }

    return {
      success: true,
      data: parsedData,
      yamlContent,
      content: remainingContent
    };

  } catch (yamlError) {
    return {
      success: false,
      error: `YAML parsing error: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`,
      yamlContent,
      content: remainingContent
    };
  }
}

/**
 * Extended metadata interface for comprehensive issue metadata extraction
 */
export interface ExtendedMetadata extends ParsedFrontMatter {
  sections?: Record<string, string>;
  complexityFromMeta?: number;
  parentFromMeta?: number;
  statusFromMeta?: string;
  priorityFromMeta?: string;
}

/**
 * Extract metadata from issue body using both YAML front-matter and markdown sections
 * 
 * This function combines YAML front-matter parsing with markdown section parsing
 * to extract comprehensive metadata from issue descriptions.
 * 
 * @param issueBody The complete issue body text
 * @returns Combined metadata from all sources
 */
export function extractIssueMetadata(issueBody: string): ExtendedMetadata {
  const frontMatterResult = parseYamlFrontMatter(issueBody);
  const result: ExtendedMetadata = frontMatterResult.data || {};
  
  // Extract additional metadata from markdown sections
  const content = frontMatterResult.content || issueBody;
  const sections: Record<string, string> = {};

  // Parse markdown sections
  const sectionRegex = /^## (.+)$/gm;
  let match;
  let lastSection = '';
  let lastIndex = 0;

  while ((match = sectionRegex.exec(content)) !== null) {
    if (lastSection) {
      sections[lastSection] = content.slice(lastIndex, match.index).trim();
    }
    lastSection = match[1];
    lastIndex = match.index + match[0].length;
  }
  
  if (lastSection) {
    sections[lastSection] = content.slice(lastIndex).trim();
  }

  // Extract metadata from Meta section
  if (sections.Meta) {
    const metaContent = sections.Meta;
    
    // Extract complexity - handle both "**Complexity**: `7 / 10`" and "Complexity: 7"
    const complexityMatch = metaContent.match(/\*?\*?complexity\*?\*?[:\s]+`?(\d+(?:\.\d+)?)\s*(?:\/\s*10)?`?/i);
    if (complexityMatch) {
      const complexity = parseFloat(complexityMatch[1]);
      if (!isNaN(complexity)) {
        result.complexityFromMeta = complexity;
        if (!result.complexity) {
          result.complexity = complexity;
        }
      }
    }

    // Extract parent task - handle "**Parent Task**: #123" format
    const parentMatch = metaContent.match(/\*?\*?parent\s+task\*?\*?[:\s]+#(\d+)/i);
    if (parentMatch) {
      const parent = parseInt(parentMatch[1], 10);
      if (!isNaN(parent)) {
        result.parentFromMeta = parent;
        if (!result.parent) {
          result.parent = parent;
        }
      }
    }

    // Extract status - handle "**Status**: `pending`" format
    const statusMatch = metaContent.match(/\*?\*?status\*?\*?[:\s]+`([^`]+)`/i);
    if (statusMatch) {
      result.statusFromMeta = statusMatch[1].trim();
      if (!result.status) {
        result.status = statusMatch[1].trim();
      }
    }

    // Extract priority - handle "**Priority**: `high`" format
    const priorityMatch = metaContent.match(/\*?\*?priority\*?\*?[:\s]+`([^`]+)`/i);
    if (priorityMatch) {
      result.priorityFromMeta = priorityMatch[1].trim();
      if (!result.priority) {
        result.priority = priorityMatch[1].trim();
      }
    }
  }

  return {
    ...result,
    sections
  };
}

/**
 * Validate parsed front-matter data
 * 
 * @param data Parsed front-matter data to validate
 * @returns Validation result with errors if any
 */
export function validateFrontMatter(data: ParsedFrontMatter): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  // Validate ID
  if (data.id !== undefined && (data.id < 1 || !Number.isInteger(data.id))) {
    errors.push('ID must be a positive integer');
  }

  // Validate parent
  if (data.parent !== undefined && (data.parent < 1 || !Number.isInteger(data.parent))) {
    errors.push('Parent must be a positive integer');
  }

  // Validate dependencies
  if (data.dependencies !== undefined) {
    if (!Array.isArray(data.dependencies)) {
      errors.push('Dependencies must be an array');
    } else {
      data.dependencies.forEach((dep, index) => {
        if (dep < 1 || !Number.isInteger(dep)) {
          errors.push(`Dependency at index ${index} must be a positive integer`);
        }
      });
    }
  }

  // Validate complexity
  if (data.complexity !== undefined && (data.complexity < 0 || data.complexity > 10)) {
    errors.push('Complexity must be between 0 and 10');
  }

  // Validate status
  if (data.status !== undefined && data.status.trim().length === 0) {
    errors.push('Status cannot be empty');
  }

  // Validate priority
  if (data.priority !== undefined && data.priority.trim().length === 0) {
    errors.push('Priority cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}