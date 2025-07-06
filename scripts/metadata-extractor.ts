/**
 * GitHub Issue Metadata Extractor
 * 
 * Extracts comprehensive metadata from GitHub issues including labels, assignees,
 * project information, comment context, and other GitHub-specific metadata needed
 * for command execution and workflow automation.
 */

import { EnhancedGitHubApi, ApiIssue } from './github-api';
import { parseIssueBody } from './issue-parser';
import { Octokit } from '@octokit/rest';
import { components } from "@octokit/openapi-types";

// GitHub API types
export type ApiComment = components["schemas"]["issue-comment"];
export type ApiLabel = components["schemas"]["label"];
export type ApiUser = components["schemas"]["simple-user"];
export type ApiMilestone = components["schemas"]["milestone"];

/**
 * Comprehensive issue metadata structure
 */
export interface IssueMetadata {
  // Basic issue information
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  locked: boolean;
  
  // User information
  author: UserInfo;
  assignees: UserInfo[];
  
  // Labels and categorization
  labels: LabelInfo[];
  
  // Project and milestone information
  milestone?: MilestoneInfo;
  projectInfo?: ProjectInfo;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  
  // Engagement metrics
  reactions: ReactionInfo;
  commentCount: number;
  
  // Related issues and references
  linkedIssues: LinkedIssue[];
  mentionedUsers: UserInfo[];
  
  // Parsed body content (from existing issue-parser)
  parsedBody: any;
  
  // GitHub-specific metadata
  url: string;
  htmlUrl: string;
  apiUrl: string;
  nodeId: string;
  
  // Additional context
  isDraft?: boolean;
  isPullRequest: boolean;
  isLocked: boolean;
  
  // Repository context
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
}

/**
 * Comment context and metadata
 */
export interface CommentContext {
  // Comment metadata
  comments: CommentInfo[];
  totalComments: number;
  
  // Comment analysis
  recentActivity: {
    lastCommentAt?: Date;
    lastCommentBy?: UserInfo;
    recentCommenters: UserInfo[];
  };
  
  // Command context
  commandHistory: CommandInfo[];
  
  // Participant information
  participants: UserInfo[];
  uniqueCommenters: number;
  
  // Activity patterns
  activityTimeline: ActivityEvent[];
}

/**
 * Individual comment information
 */
export interface CommentInfo {
  id: number;
  body: string;
  author: UserInfo;
  createdAt: Date;
  updatedAt: Date;
  reactions: ReactionInfo;
  url: string;
  htmlUrl: string;
  
  // Parsed content
  containsCommand: boolean;
  commands: CommandInfo[];
  mentions: UserInfo[];
  issueReferences: number[];
}

/**
 * Command information from comments
 */
export interface CommandInfo {
  command: string;
  rawText: string;
  arguments: Record<string, any>;
  isValid: boolean;
  errors: string[];
  commentId: number;
  author: UserInfo;
  timestamp: Date;
}

/**
 * User information
 */
export interface UserInfo {
  login: string;
  id: number;
  type: 'User' | 'Bot' | 'Organization';
  avatarUrl: string;
  htmlUrl: string;
  siteAdmin: boolean;
}

/**
 * Label information with enhanced metadata
 */
export interface LabelInfo {
  id: number;
  name: string;
  description?: string;
  color: string;
  isDefault: boolean;
  url: string;
  
  // Taskmaster-specific label analysis
  category?: LabelCategory;
  priority?: number;
  isTaskmasterLabel: boolean;
}

/**
 * Label categories for better organization
 */
export enum LabelCategory {
  STATUS = 'status',
  PRIORITY = 'priority', 
  COMPLEXITY = 'complexity',
  TYPE = 'type',
  DEPENDENCY = 'dependency',
  HIERARCHY = 'hierarchy',
  TASKMASTER = 'taskmaster',
  CUSTOM = 'custom'
}

/**
 * Milestone information
 */
export interface MilestoneInfo {
  id: number;
  number: number;
  title: string;
  description?: string;
  state: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  dueOn?: Date;
  closedAt?: Date;
  openIssues: number;
  closedIssues: number;
  url: string;
  htmlUrl: string;
}

/**
 * Project information (GitHub Projects v2)
 */
export interface ProjectInfo {
  // Note: GitHub Projects v2 API is complex, this is a simplified structure
  projects: Array<{
    id: string;
    title: string;
    url: string;
    status?: string;
    priority?: string;
  }>;
}

/**
 * Reaction information
 */
export interface ReactionInfo {
  totalCount: number;
  plusOne: number;
  minusOne: number;
  laugh: number;
  confused: number;
  heart: number;
  hooray: number;
  rocket: number;
  eyes: number;
  url: string;
}

/**
 * Linked issue information
 */
export interface LinkedIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  relationship: 'parent' | 'child' | 'dependency' | 'blocks' | 'reference';
  url: string;
}

/**
 * Activity event for timeline
 */
export interface ActivityEvent {
  type: 'comment' | 'label' | 'assignment' | 'status_change' | 'reference';
  timestamp: Date;
  actor: UserInfo;
  details: any;
}

/**
 * Metadata extraction options
 */
export interface MetadataExtractionOptions {
  // What to include
  includeComments?: boolean;
  includeReactions?: boolean;
  includeLinkedIssues?: boolean;
  includeProjectInfo?: boolean;
  includeParsedBody?: boolean;
  
  // Comment-specific options
  maxComments?: number;
  includeCommandHistory?: boolean;
  parseCommands?: boolean;
  
  // Analysis options
  analyzeLabelCategories?: boolean;
  extractMentions?: boolean;
  buildActivityTimeline?: boolean;
  
  // Performance options
  useCache?: boolean;
  cacheTimeout?: number;
}

/**
 * Main metadata extractor class
 */
export class GitHubMetadataExtractor {
  private githubApi: EnhancedGitHubApi;
  private cache = new Map<string, { data: any; timestamp: number }>();
  
  constructor(githubApi: EnhancedGitHubApi) {
    this.githubApi = githubApi;
  }

  /**
   * Extract comprehensive metadata for an issue
   */
  async extractIssueMetadata(
    issueNumber: number,
    options: MetadataExtractionOptions = {}
  ): Promise<IssueMetadata> {
    const defaultOptions: Required<MetadataExtractionOptions> = {
      includeComments: true,
      includeReactions: true,
      includeLinkedIssues: true,
      includeProjectInfo: false, // Complex and requires additional permissions
      includeParsedBody: true,
      maxComments: 100,
      includeCommandHistory: true,
      parseCommands: true,
      analyzeLabelCategories: true,
      extractMentions: true,
      buildActivityTimeline: true,
      useCache: true,
      cacheTimeout: 300000 // 5 minutes
    };

    const opts = { ...defaultOptions, ...options };
    const cacheKey = `issue-${issueNumber}-${JSON.stringify(opts)}`;

    // Check cache
    if (opts.useCache) {
      const cached = this.getCached(cacheKey, opts.cacheTimeout);
      if (cached) {
        return cached;
      }
    }

    try {
      // Get basic issue data
      const issue = await this.getIssue(issueNumber);
      
      // Extract basic metadata
      const metadata = await this.extractBasicMetadata(issue, opts);
      
      // Extract comment context if requested
      if (opts.includeComments) {
        const commentContext = await this.extractCommentContext(issueNumber, opts);
        Object.assign(metadata, { commentContext });
      }

      // Cache result
      if (opts.useCache) {
        this.setCached(cacheKey, metadata);
      }

      return metadata;
    } catch (error) {
      throw new Error(`Failed to extract metadata for issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract comment context and history
   */
  async extractCommentContext(
    issueNumber: number,
    options: MetadataExtractionOptions = {}
  ): Promise<CommentContext> {
    const cacheKey = `comments-${issueNumber}`;
    
    if (options.useCache) {
      const cached = this.getCached(cacheKey, options.cacheTimeout || 300000);
      if (cached) {
        return cached;
      }
    }

    try {
      // Get comments from GitHub API
      const comments = await this.getIssueComments(issueNumber, options.maxComments);
      
      // Process comments
      const commentInfos = await Promise.all(
        comments.map(comment => this.processComment(comment, options))
      );

      // Build comment context
      const context = this.buildCommentContext(commentInfos, options);

      if (options.useCache) {
        this.setCached(cacheKey, context);
      }

      return context;
    } catch (error) {
      throw new Error(`Failed to extract comment context for issue #${issueNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get issue data from GitHub API
   */
  private async getIssue(issueNumber: number): Promise<ApiIssue> {
    const issue = await this.githubApi.client.issues.get({
      owner: this.githubApi['config'].owner,
      repo: this.githubApi['config'].repo,
      issue_number: issueNumber
    });
    
    return issue.data as ApiIssue;
  }

  /**
   * Get issue comments from GitHub API
   */
  private async getIssueComments(issueNumber: number, maxComments: number = 100): Promise<ApiComment[]> {
    const comments = await this.githubApi.client.issues.listComments({
      owner: this.githubApi['config'].owner,
      repo: this.githubApi['config'].repo,
      issue_number: issueNumber,
      per_page: Math.min(maxComments, 100),
      sort: 'created',
      direction: 'asc'
    });
    
    return comments.data as ApiComment[];
  }

  /**
   * Extract basic metadata from issue
   */
  private async extractBasicMetadata(
    issue: ApiIssue,
    options: MetadataExtractionOptions
  ): Promise<IssueMetadata> {
    const metadata: IssueMetadata = {
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state as 'open' | 'closed',
      locked: issue.locked,
      
      author: this.convertToUserInfo(issue.user),
      assignees: issue.assignees ? issue.assignees.map(a => this.convertToUserInfo(a)) : [],
      
      labels: issue.labels ? issue.labels.map(l => this.convertToLabelInfo(l)) : [],
      
      milestone: issue.milestone ? this.convertToMilestoneInfo(issue.milestone) : undefined,
      
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
      
      reactions: this.convertToReactionInfo(issue.reactions),
      commentCount: issue.comments,
      
      linkedIssues: [], // Will be populated by linked issue extraction
      mentionedUsers: [], // Will be populated by mention extraction
      
      parsedBody: options.includeParsedBody ? parseIssueBody(issue.body || '') : {},
      
      url: issue.url,
      htmlUrl: issue.html_url,
      apiUrl: issue.url,
      nodeId: issue.node_id,
      
      isPullRequest: 'pull_request' in issue && issue.pull_request !== null,
      isLocked: issue.locked,
      
      repository: {
        owner: this.githubApi['config'].owner,
        name: this.githubApi['config'].repo,
        fullName: `${this.githubApi['config'].owner}/${this.githubApi['config'].repo}`
      }
    };

    // Extract linked issues if requested
    if (options.includeLinkedIssues) {
      metadata.linkedIssues = this.extractLinkedIssues(issue.body || '');
    }

    // Extract mentioned users if requested
    if (options.extractMentions) {
      metadata.mentionedUsers = this.extractMentionedUsers(issue.body || '');
    }

    return metadata;
  }

  /**
   * Process individual comment
   */
  private async processComment(
    comment: ApiComment,
    options: MetadataExtractionOptions
  ): Promise<CommentInfo> {
    const commentInfo: CommentInfo = {
      id: comment.id,
      body: comment.body || '',
      author: this.convertToUserInfo(comment.user),
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.updated_at),
      reactions: this.convertToReactionInfo(comment.reactions),
      url: comment.url,
      htmlUrl: comment.html_url,
      
      containsCommand: false,
      commands: [],
      mentions: [],
      issueReferences: []
    };

    // Parse commands if requested
    if (options.parseCommands) {
      commentInfo.commands = this.parseCommandsFromComment(comment, options);
      commentInfo.containsCommand = commentInfo.commands.length > 0;
    }

    // Extract mentions
    if (options.extractMentions) {
      commentInfo.mentions = this.extractMentionedUsers(comment.body || '');
    }

    // Extract issue references
    commentInfo.issueReferences = this.extractIssueReferences(comment.body || '');

    return commentInfo;
  }

  /**
   * Build comprehensive comment context
   */
  private buildCommentContext(
    comments: CommentInfo[],
    options: MetadataExtractionOptions
  ): CommentContext {
    const sortedComments = comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Get unique participants
    const participants = new Map<string, UserInfo>();
    for (const comment of comments) {
      participants.set(comment.author.login, comment.author);
    }

    // Extract commands
    const commandHistory = comments
      .flatMap(c => c.commands)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Build activity timeline
    const activityTimeline: ActivityEvent[] = [];
    if (options.buildActivityTimeline) {
      for (const comment of sortedComments) {
        activityTimeline.push({
          type: 'comment',
          timestamp: comment.createdAt,
          actor: comment.author,
          details: {
            commentId: comment.id,
            hasCommand: comment.containsCommand,
            commandCount: comment.commands.length
          }
        });
      }
    }

    // Recent activity analysis
    const recentComments = sortedComments.slice(-5); // Last 5 comments
    const recentCommenters = [...new Map(
      recentComments.map(c => [c.author.login, c.author])
    ).values()];

    return {
      comments: sortedComments,
      totalComments: comments.length,
      
      recentActivity: {
        lastCommentAt: sortedComments.length > 0 ? sortedComments[sortedComments.length - 1].createdAt : undefined,
        lastCommentBy: sortedComments.length > 0 ? sortedComments[sortedComments.length - 1].author : undefined,
        recentCommenters
      },
      
      commandHistory,
      
      participants: Array.from(participants.values()),
      uniqueCommenters: participants.size,
      
      activityTimeline
    };
  }

  /**
   * Parse commands from comment using existing comment parser
   */
  private parseCommandsFromComment(
    comment: ApiComment,
    options: MetadataExtractionOptions
  ): CommandInfo[] {
    // Import the comment parser functions
    try {
      const { parseCommand, containsCommand } = require('./comment-parser');
      
      if (!containsCommand(comment.body || '')) {
        return [];
      }

      const parsedCommand = parseCommand(comment.body || '');
      if (!parsedCommand) {
        return [];
      }

      return [{
        command: parsedCommand.command,
        rawText: parsedCommand.rawText,
        arguments: parsedCommand.args,
        isValid: parsedCommand.isValid,
        errors: parsedCommand.errors,
        commentId: comment.id,
        author: this.convertToUserInfo(comment.user),
        timestamp: new Date(comment.created_at)
      }];
    } catch (error) {
      // If comment parser is not available, return empty array
      return [];
    }
  }

  /**
   * Extract linked issues from text content
   */
  private extractLinkedIssues(content: string): LinkedIssue[] {
    const issues: LinkedIssue[] = [];
    
    // Patterns for different types of issue references
    const patterns = [
      { pattern: /(?:parent|parent task)[:\s]+#(\d+)/gi, relationship: 'parent' as const },
      { pattern: /(?:child|subtask|sub-task)[:\s]+#(\d+)/gi, relationship: 'child' as const },
      { pattern: /(?:depends on|dependency)[:\s]+#(\d+)/gi, relationship: 'dependency' as const },
      { pattern: /(?:blocks|blocking)[:\s]+#(\d+)/gi, relationship: 'blocks' as const },
      { pattern: /#(\d+)/g, relationship: 'reference' as const }
    ];

    for (const { pattern, relationship } of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const issueNumber = parseInt(match[1], 10);
        
        // Avoid duplicates
        if (!issues.some(issue => issue.number === issueNumber)) {
          issues.push({
            number: issueNumber,
            title: '', // Would need additional API call to get title
            state: 'open', // Would need additional API call to get state
            relationship,
            url: `https://github.com/${this.githubApi['config'].owner}/${this.githubApi['config'].repo}/issues/${issueNumber}`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Extract mentioned users from text content
   */
  private extractMentionedUsers(content: string): UserInfo[] {
    const mentions: UserInfo[] = [];
    const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
    
    let match;
    while ((match = mentionPattern.exec(content)) !== null) {
      const username = match[1];
      
      // Avoid duplicates
      if (!mentions.some(user => user.login === username)) {
        mentions.push({
          login: username,
          id: 0, // Would need additional API call to get ID
          type: 'User',
          avatarUrl: '',
          htmlUrl: `https://github.com/${username}`,
          siteAdmin: false
        });
      }
    }

    return mentions;
  }

  /**
   * Extract issue references from text content
   */
  private extractIssueReferences(content: string): number[] {
    const references: number[] = [];
    const issuePattern = /#(\d+)/g;
    
    let match;
    while ((match = issuePattern.exec(content)) !== null) {
      const issueNumber = parseInt(match[1], 10);
      if (!references.includes(issueNumber)) {
        references.push(issueNumber);
      }
    }

    return references;
  }

  /**
   * Convert GitHub user object to UserInfo
   */
  private convertToUserInfo(user: any): UserInfo {
    return {
      login: user?.login || '',
      id: user?.id || 0,
      type: user?.type || 'User',
      avatarUrl: user?.avatar_url || '',
      htmlUrl: user?.html_url || '',
      siteAdmin: user?.site_admin || false
    };
  }

  /**
   * Convert GitHub label object to LabelInfo
   */
  private convertToLabelInfo(label: any): LabelInfo {
    const labelInfo: LabelInfo = {
      id: label.id,
      name: label.name,
      description: label.description,
      color: label.color,
      isDefault: label.default || false,
      url: label.url,
      category: this.categorizeLabel(label.name),
      isTaskmasterLabel: this.isTaskmasterLabel(label.name)
    };

    // Extract priority from label name if it's a priority label
    if (labelInfo.category === LabelCategory.PRIORITY) {
      labelInfo.priority = this.extractPriorityFromLabel(label.name);
    }

    return labelInfo;
  }

  /**
   * Convert GitHub milestone object to MilestoneInfo
   */
  private convertToMilestoneInfo(milestone: any): MilestoneInfo {
    return {
      id: milestone.id,
      number: milestone.number,
      title: milestone.title,
      description: milestone.description,
      state: milestone.state,
      createdAt: new Date(milestone.created_at),
      updatedAt: new Date(milestone.updated_at),
      dueOn: milestone.due_on ? new Date(milestone.due_on) : undefined,
      closedAt: milestone.closed_at ? new Date(milestone.closed_at) : undefined,
      openIssues: milestone.open_issues,
      closedIssues: milestone.closed_issues,
      url: milestone.url,
      htmlUrl: milestone.html_url
    };
  }

  /**
   * Convert GitHub reactions object to ReactionInfo
   */
  private convertToReactionInfo(reactions: any): ReactionInfo {
    return {
      totalCount: reactions?.total_count || 0,
      plusOne: reactions?.['+1'] || 0,
      minusOne: reactions?.['-1'] || 0,
      laugh: reactions?.laugh || 0,
      confused: reactions?.confused || 0,
      heart: reactions?.heart || 0,
      hooray: reactions?.hooray || 0,
      rocket: reactions?.rocket || 0,
      eyes: reactions?.eyes || 0,
      url: reactions?.url || ''
    };
  }

  /**
   * Categorize label based on naming conventions
   */
  private categorizeLabel(labelName: string): LabelCategory {
    const name = labelName.toLowerCase();
    
    if (name.startsWith('status:') || ['pending', 'in-progress', 'completed', 'blocked'].includes(name)) {
      return LabelCategory.STATUS;
    }
    
    if (name.startsWith('priority:') || ['critical', 'high', 'medium', 'low'].includes(name)) {
      return LabelCategory.PRIORITY;
    }
    
    if (name.startsWith('complexity:') || name.includes('complexity')) {
      return LabelCategory.COMPLEXITY;
    }
    
    if (name.startsWith('type:') || ['bug', 'feature', 'enhancement', 'documentation'].includes(name)) {
      return LabelCategory.TYPE;
    }
    
    if (name.includes('dependency') || name.includes('blocked') || name.includes('waiting')) {
      return LabelCategory.DEPENDENCY;
    }
    
    if (name.includes('parent') || name.includes('child') || name.includes('subtask')) {
      return LabelCategory.HIERARCHY;
    }
    
    if (name.includes('taskmaster') || name === 'taskmaster') {
      return LabelCategory.TASKMASTER;
    }
    
    return LabelCategory.CUSTOM;
  }

  /**
   * Check if label is a Taskmaster-specific label
   */
  private isTaskmasterLabel(labelName: string): boolean {
    const name = labelName.toLowerCase();
    const taskmasterPrefixes = ['taskmaster', 'status:', 'priority:', 'complexity:', 'parent:', 'child:'];
    
    return taskmasterPrefixes.some(prefix => name.startsWith(prefix)) || name === 'taskmaster';
  }

  /**
   * Extract priority number from priority label
   */
  private extractPriorityFromLabel(labelName: string): number {
    const name = labelName.toLowerCase();
    
    if (name.includes('critical')) return 5;
    if (name.includes('high')) return 4;
    if (name.includes('medium')) return 3;
    if (name.includes('low')) return 2;
    if (name.includes('trivial')) return 1;
    
    // Try to extract number from label like "priority:3"
    const match = name.match(/priority:(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    
    return 3; // Default to medium
  }

  /**
   * Cache management
   */
  private getCached(key: string, timeout: number): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data;
    }
    return null;
  }

  private setCached(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Factory function to create metadata extractor
 */
export function createMetadataExtractor(githubApi: EnhancedGitHubApi): GitHubMetadataExtractor {
  return new GitHubMetadataExtractor(githubApi);
}

/**
 * Utility function to extract basic metadata without creating an extractor instance
 */
export async function extractBasicIssueMetadata(
  githubApi: EnhancedGitHubApi,
  issueNumber: number
): Promise<IssueMetadata> {
  const extractor = new GitHubMetadataExtractor(githubApi);
  return extractor.extractIssueMetadata(issueNumber, {
    includeComments: false,
    includeProjectInfo: false,
    buildActivityTimeline: false
  });
}

/**
 * Utility function to extract only comment context
 */
export async function extractCommentContextOnly(
  githubApi: EnhancedGitHubApi,
  issueNumber: number,
  maxComments: number = 50
): Promise<CommentContext> {
  const extractor = new GitHubMetadataExtractor(githubApi);
  return extractor.extractCommentContext(issueNumber, { maxComments });
}