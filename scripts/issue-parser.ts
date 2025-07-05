/**
 * Issue Parser
 * 
 * Parses structured data from GitHub issue descriptions, including YAML front-matter,
 * dependencies, priority, and other metadata fields.
 */

import * as yaml from 'js-yaml';

// Interfaces for parsed data
export interface ParsedYamlFrontMatter {
  id?: number;
  parent?: number;
  dependencies?: number[];
  [key: string]: any;
}

export interface ParsedMetadata {
  status?: string;
  priority?: string;
  complexity?: string;
  [key: string]: string | undefined;
}

export interface ParsedDependency {
  issueNumber: number;
  completed: boolean;
  title?: string;
}

export interface ParsedIssueData {
  yamlFrontMatter: ParsedYamlFrontMatter;
  metadata: ParsedMetadata;
  dependencies: ParsedDependency[];
  requiredBy: ParsedDependency[];
  description?: string;
  details?: string;
  testStrategy?: string;
  rawBody: string;
}

/**
 * Parse YAML front-matter from issue body
 */
export function parseYamlFrontMatter(body: string): ParsedYamlFrontMatter {
  const frontMatterMatch = body.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontMatterMatch) {
    return {};
  }
  
  try {
    const yamlContent = frontMatterMatch[1];
    const parsed = yaml.load(yamlContent) as any;
    
    // Ensure arrays are properly parsed
    if (parsed && typeof parsed === 'object') {
      // Handle dependencies array format
      if (parsed.dependencies) {
        if (typeof parsed.dependencies === 'string') {
          // Handle format like "dependencies: [1, 2, 3]"
          const arrayMatch = parsed.dependencies.match(/\[([^\]]+)\]/);
          if (arrayMatch) {
            parsed.dependencies = arrayMatch[1]
              .split(',')
              .map((dep: string) => parseInt(dep.trim(), 10))
              .filter((dep: number) => !isNaN(dep));
          }
        } else if (Array.isArray(parsed.dependencies)) {
          // Already an array, ensure numbers
          parsed.dependencies = parsed.dependencies
            .map((dep: any) => typeof dep === 'number' ? dep : parseInt(String(dep), 10))
            .filter((dep: number) => !isNaN(dep));
        }
      }
      
      // Ensure id and parent are numbers
      if (parsed.id !== undefined) {
        parsed.id = typeof parsed.id === 'number' ? parsed.id : parseInt(String(parsed.id), 10);
      }
      if (parsed.parent !== undefined) {
        parsed.parent = typeof parsed.parent === 'number' ? parsed.parent : parseInt(String(parsed.parent), 10);
      }
    }
    
    return parsed || {};
  } catch (error) {
    console.warn('Failed to parse YAML front-matter:', error);
    return {};
  }
}

/**
 * Parse metadata from Meta section
 */
export function parseMetadata(body: string): ParsedMetadata {
  const metaMatch = body.match(/## Meta\s*\n\n([\s\S]*?)(?:\n\n|$)/);
  
  if (!metaMatch) {
    return {};
  }
  
  const metaContent = metaMatch[1];
  const metadata: ParsedMetadata = {};
  
  // Parse lines like "- **Status**: `pending`"
  const metaLines = metaContent.split('\n');
  
  for (const line of metaLines) {
    const match = line.match(/- \*\*([^*]+)\*\*:\s*`([^`]+)`/);
    if (match) {
      const key = match[1].toLowerCase().trim();
      const value = match[2].trim();
      metadata[key] = value;
    }
  }
  
  return metadata;
}

/**
 * Parse dependencies from Dependencies section
 */
export function parseDependencies(body: string): ParsedDependency[] {
  const depsMatch = body.match(/## Dependencies\s*\n\n([\s\S]*?)(?:\n\n|$)/);
  
  if (!depsMatch) {
    return [];
  }
  
  const depsContent = depsMatch[1];
  const dependencies: ParsedDependency[] = [];
  
  // Parse lines like "- [x] #123" or "- [ ] Task #456"
  const depLines = depsContent.split('\n');
  
  for (const line of depLines) {
    const match = line.match(/- \[([x ])\]\s*(?:Task\s*)?#(\d+)(?:\s+(.*))?/);
    if (match) {
      const completed = match[1] === 'x';
      const issueNumber = parseInt(match[2], 10);
      const title = match[3]?.trim();
      
      dependencies.push({
        issueNumber,
        completed,
        title
      });
    }
  }
  
  return dependencies;
}

/**
 * Parse required-by relationships from Required By section
 */
export function parseRequiredBy(body: string): ParsedDependency[] {
  const reqByMatch = body.match(/## Required By\s*\n\n([\s\S]*?)(?:\n\n|$)/);
  
  if (!reqByMatch) {
    return [];
  }
  
  const reqByContent = reqByMatch[1];
  const requiredBy: ParsedDependency[] = [];
  
  // Parse lines like "- [ ] #123"
  const reqByLines = reqByContent.split('\n');
  
  for (const line of reqByLines) {
    const match = line.match(/- \[([x ])\]\s*#(\d+)(?:\s+(.*))?/);
    if (match) {
      const completed = match[1] === 'x';
      const issueNumber = parseInt(match[2], 10);
      const title = match[3]?.trim();
      
      requiredBy.push({
        issueNumber,
        completed,
        title
      });
    }
  }
  
  return requiredBy;
}

/**
 * Parse content sections (Description, Details, Test Strategy)
 */
export function parseContentSections(body: string): {
  description?: string;
  details?: string;
  testStrategy?: string;
} {
  const result: { description?: string; details?: string; testStrategy?: string } = {};
  
  // Parse Description section
  const descMatch = body.match(/## Description\s*\n\n([\s\S]*?)(?:\n\n##|\n\n<!-- |$)/);
  if (descMatch) {
    result.description = descMatch[1].trim();
  }
  
  // Parse Details section
  const detailsMatch = body.match(/## Details\s*\n\n([\s\S]*?)(?:\n\n##|\n\n<!-- |$)/);
  if (detailsMatch) {
    result.details = detailsMatch[1].trim();
  }
  
  // Parse Test Strategy section
  const testMatch = body.match(/## Test Strategy\s*\n\n([\s\S]*?)(?:\n\n##|\n\n<!-- |$)/);
  if (testMatch) {
    result.testStrategy = testMatch[1].trim();
  }
  
  return result;
}

/**
 * Comprehensive parser that extracts all structured data from issue description
 */
export function parseIssueBody(body: string): ParsedIssueData {
  const yamlFrontMatter = parseYamlFrontMatter(body);
  const metadata = parseMetadata(body);
  const dependencies = parseDependencies(body);
  const requiredBy = parseRequiredBy(body);
  const contentSections = parseContentSections(body);
  
  return {
    yamlFrontMatter,
    metadata,
    dependencies,
    requiredBy,
    ...contentSections,
    rawBody: body
  };
}

/**
 * Utility function to check if issue body has YAML front-matter
 */
export function hasYamlFrontMatter(body: string): boolean {
  return /^---\n[\s\S]*?\n---/.test(body);
}

/**
 * Utility function to extract task ID from YAML front-matter or title
 */
export function extractTaskId(body: string, title?: string): number | undefined {
  // First try YAML front-matter
  const yamlData = parseYamlFrontMatter(body);
  if (yamlData.id !== undefined) {
    return yamlData.id;
  }
  
  // Fall back to title format like "[123] Task Title" or "[1.2] Subtask Title"
  if (title) {
    const titleMatch = title.match(/^\[(\d+(?:\.\d+)?)\]/);
    if (titleMatch) {
      const idStr = titleMatch[1];
      if (idStr.includes('.')) {
        // Subtask format like "1.2" - return the subtask ID part
        return parseInt(idStr.split('.')[1], 10);
      } else {
        // Main task format like "123"
        return parseInt(idStr, 10);
      }
    }
  }
  
  return undefined;
}

/**
 * Utility function to extract parent task ID
 */
export function extractParentId(body: string, title?: string): number | undefined {
  // First try YAML front-matter
  const yamlData = parseYamlFrontMatter(body);
  if (yamlData.parent !== undefined) {
    return yamlData.parent;
  }
  
  // Fall back to title format like "[1.2] Subtask Title"
  if (title) {
    const titleMatch = title.match(/^\[(\d+)\.(\d+)\]/);
    if (titleMatch) {
      return parseInt(titleMatch[1], 10);
    }
  }
  
  return undefined;
}