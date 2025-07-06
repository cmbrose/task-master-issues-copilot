/**
 * Enhanced Structured Logging with Correlation ID Support
 * 
 * Provides comprehensive logging capabilities with correlation tracking,
 * structured formatting, and integration with error recovery workflows.
 */

import { CorrelationTracker, CorrelationContext, formatCorrelationInfo } from './correlation-tracking';
import { ClassifiedError, ErrorSeverity } from './error-categorization';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Log categories for grouping related logs
 */
export enum LogCategory {
  SYSTEM = 'system',
  OPERATION = 'operation',
  ERROR_RECOVERY = 'error_recovery',
  GITHUB_API = 'github_api',
  ARTIFACT = 'artifact',
  BATCH_PROCESSING = 'batch_processing',
  IDEMPOTENCY = 'idempotency',
  WORKFLOW = 'workflow',
  VALIDATION = 'validation',
  PERFORMANCE = 'performance'
}

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Unique log entry ID */
  id: string;
  /** Log timestamp */
  timestamp: Date;
  /** Log level */
  level: LogLevel;
  /** Log category */
  category: LogCategory;
  /** Log message */
  message: string;
  /** Correlation ID for operation tracking */
  correlationId?: string;
  /** Parent correlation ID */
  parentCorrelationId?: string;
  /** Operation type */
  operationType?: string;
  /** Operation depth in chain */
  operationDepth?: number;
  /** Additional structured data */
  data?: Record<string, any>;
  /** Error information if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
    classification?: any;
  };
  /** Performance metrics */
  performance?: {
    duration?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  /** Request/response information */
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    status?: number;
    headers?: Record<string, string>;
    body?: any;
  };
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to enable console output */
  enableConsole: boolean;
  /** Whether to enable file output */
  enableFile: boolean;
  /** Log file path */
  logFile?: string;
  /** Whether to enable structured JSON output */
  enableStructuredOutput: boolean;
  /** Whether to include stack traces for errors */
  includeStackTraces: boolean;
  /** Maximum log entries to keep in memory */
  maxLogEntries: number;
  /** Whether to enable performance tracking */
  enablePerformanceTracking: boolean;
  /** Custom log formatters */
  customFormatters?: Map<LogCategory, (entry: LogEntry) => string>;
}

/**
 * Performance measurement context
 */
interface PerformanceContext {
  startTime: number;
  startMemory: number;
  correlationId: string;
  operationType: string;
}

/**
 * Enhanced structured logger
 */
export class StructuredLogger {
  private static instance: StructuredLogger;
  private config: Required<LoggingConfig>;
  private logEntries: LogEntry[] = [];
  private performanceContexts: Map<string, PerformanceContext> = new Map();
  private correlationTracker: CorrelationTracker;
  private logCounter = 0;

  private constructor(config: Partial<LoggingConfig> = {}) {
    this.correlationTracker = CorrelationTracker.getInstance();
    
    this.config = {
      minLevel: config.minLevel || LogLevel.INFO,
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      logFile: config.logFile || 'taskmaster.log',
      enableStructuredOutput: config.enableStructuredOutput ?? false,
      includeStackTraces: config.includeStackTraces ?? true,
      maxLogEntries: config.maxLogEntries || 10000,
      enablePerformanceTracking: config.enablePerformanceTracking ?? true,
      customFormatters: config.customFormatters || new Map()
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggingConfig>): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(config);
    }
    return StructuredLogger.instance;
  }

  /**
   * Log debug message
   */
  debug(message: string, category: LogCategory = LogCategory.SYSTEM, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, category: LogCategory = LogCategory.SYSTEM, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, category: LogCategory = LogCategory.SYSTEM, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, category: LogCategory = LogCategory.SYSTEM, error?: Error | ClassifiedError, data?: Record<string, any>): void {
    const errorData = error ? this.serializeError(error) : undefined;
    this.log(LogLevel.ERROR, category, message, { ...data, error: errorData });
  }

  /**
   * Log critical message
   */
  critical(message: string, category: LogCategory = LogCategory.SYSTEM, error?: Error | ClassifiedError, data?: Record<string, any>): void {
    const errorData = error ? this.serializeError(error) : undefined;
    this.log(LogLevel.CRITICAL, category, message, { ...data, error: errorData });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: Record<string, any>): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return;
    }

    const context = this.correlationTracker.getCurrentContext();
    const entry: LogEntry = {
      id: `log_${++this.logCounter}_${Date.now()}`,
      timestamp: new Date(),
      level,
      category,
      message,
      correlationId: context?.correlationId,
      parentCorrelationId: context?.parentCorrelationId,
      operationType: context?.operationType,
      operationDepth: context?.depth,
      data: data || {}
    };

    // Add error information if present
    if (data?.error) {
      entry.error = data.error;
    }

    // Store log entry
    this.logEntries.push(entry);
    
    // Trim log entries if needed
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }

    // Output log
    this.outputLog(entry);
  }

  /**
   * Start performance measurement
   */
  startPerformanceMeasurement(operationType: string, correlationId?: string): string {
    if (!this.config.enablePerformanceTracking) {
      return '';
    }

    const id = correlationId || this.correlationTracker.getCurrentContext()?.correlationId || `perf_${Date.now()}`;
    const perfContext: PerformanceContext = {
      startTime: performance.now(),
      startMemory: process.memoryUsage().heapUsed,
      correlationId: id,
      operationType
    };

    this.performanceContexts.set(id, perfContext);
    return id;
  }

  /**
   * End performance measurement
   */
  endPerformanceMeasurement(id: string, additionalData?: Record<string, any>): void {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    const perfContext = this.performanceContexts.get(id);
    if (!perfContext) {
      return;
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - perfContext.startTime;
    const memoryDelta = endMemory - perfContext.startMemory;

    this.info(
      `Performance: ${perfContext.operationType} completed`,
      LogCategory.PERFORMANCE,
      {
        ...additionalData,
        performance: {
          duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
          memoryUsage: endMemory,
          memoryDelta,
          operationType: perfContext.operationType
        }
      }
    );

    this.performanceContexts.delete(id);
  }

  /**
   * Log operation start with correlation tracking
   */
  logOperationStart(operationType: string, data?: Record<string, any>): void {
    const context = this.correlationTracker.getCurrentContext();
    const correlationInfo = formatCorrelationInfo(context);
    
    this.info(
      `${correlationInfo} 🚀 Starting operation: ${operationType}`,
      LogCategory.OPERATION,
      {
        operationType,
        phase: 'start',
        ...data
      }
    );

    // Start performance measurement
    if (context) {
      this.startPerformanceMeasurement(operationType, context.correlationId);
    }
  }

  /**
   * Log operation completion
   */
  logOperationComplete(operationType: string, success: boolean, data?: Record<string, any>): void {
    const context = this.correlationTracker.getCurrentContext();
    const correlationInfo = formatCorrelationInfo(context);
    const emoji = success ? '✅' : '❌';
    const status = success ? 'SUCCESS' : 'FAILED';
    
    this.info(
      `${correlationInfo} ${emoji} Operation completed: ${operationType} - ${status}`,
      LogCategory.OPERATION,
      {
        operationType,
        phase: 'complete',
        success,
        ...data
      }
    );

    // End performance measurement
    if (context) {
      this.endPerformanceMeasurement(context.correlationId, data);
    }
  }

  /**
   * Log error recovery attempt
   */
  logErrorRecovery(
    action: string,
    error: ClassifiedError,
    attempt: number,
    maxAttempts: number,
    data?: Record<string, any>
  ): void {
    const context = this.correlationTracker.getCurrentContext();
    const correlationInfo = formatCorrelationInfo(context);
    
    this.warn(
      `${correlationInfo} 🔄 Error recovery: ${action} (attempt ${attempt}/${maxAttempts})`,
      LogCategory.ERROR_RECOVERY,
      {
        action,
        attempt,
        maxAttempts,
        errorCategory: error.classification.category,
        errorRecoverability: error.classification.recoverability,
        errorSeverity: error.classification.severity,
        originalError: error.message,
        ...data
      }
    );
  }

  /**
   * Log API request/response
   */
  logApiCall(
    method: string,
    url: string,
    status?: number,
    duration?: number,
    error?: Error,
    requestData?: any,
    responseData?: any
  ): void {
    const context = this.correlationTracker.getCurrentContext();
    const correlationInfo = formatCorrelationInfo(context);
    const success = !error && status && status < 400;
    const emoji = success ? '📡' : '⚠️';
    
    const level = error ? LogLevel.ERROR : (status && status >= 400 ? LogLevel.WARN : LogLevel.DEBUG);
    
    this.log(
      level,
      LogCategory.GITHUB_API,
      `${correlationInfo} ${emoji} API ${method} ${url} - ${status || 'FAILED'}${duration ? ` (${Math.round(duration)}ms)` : ''}`,
      {
        request: {
          method,
          url,
          body: requestData
        },
        response: {
          status,
          body: responseData
        },
        performance: duration ? { duration } : undefined,
        error: error ? this.serializeError(error) : undefined
      }
    );
  }

  /**
   * Get log entries with optional filtering
   */
  getLogEntries(filter?: {
    level?: LogLevel;
    category?: LogCategory;
    correlationId?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let entries = [...this.logEntries];

    if (filter) {
      if (filter.level) {
        entries = entries.filter(entry => entry.level === filter.level);
      }
      
      if (filter.category) {
        entries = entries.filter(entry => entry.category === filter.category);
      }
      
      if (filter.correlationId) {
        entries = entries.filter(entry => 
          entry.correlationId === filter.correlationId ||
          entry.parentCorrelationId === filter.correlationId
        );
      }
      
      if (filter.since) {
        entries = entries.filter(entry => entry.timestamp >= filter.since!);
      }
      
      if (filter.limit) {
        entries = entries.slice(-filter.limit);
      }
    }

    return entries;
  }

  /**
   * Get correlation trace for debugging
   */
  getCorrelationTrace(correlationId: string): LogEntry[] {
    const tracker = this.correlationTracker;
    const chain = tracker.getOperationChain(correlationId);
    const correlationIds = chain.map(c => c.correlationId);
    
    return this.logEntries.filter(entry =>
      correlationIds.includes(entry.correlationId || '') ||
      correlationIds.includes(entry.parentCorrelationId || '')
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Export logs for analysis
   */
  exportLogs(format: 'json' | 'csv' | 'text' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logEntries, null, 2);
      
      case 'csv':
        return this.exportAsCsv();
      
      case 'text':
        return this.exportAsText();
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear old log entries
   */
  clearOldLogs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.logEntries = this.logEntries.filter(entry => entry.timestamp > cutoffTime);
  }

  /**
   * Check if we should log at this level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    const currentIndex = levels.indexOf(this.config.minLevel);
    const logIndex = levels.indexOf(level);
    return logIndex >= currentIndex;
  }

  /**
   * Output log entry to configured destinations
   */
  private outputLog(entry: LogEntry): void {
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    if (this.config.enableFile && this.config.logFile) {
      this.outputToFile(entry);
    }
  }

  /**
   * Output to console with formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const correlationInfo = entry.correlationId ? formatCorrelationInfo({
      correlationId: entry.correlationId,
      parentCorrelationId: entry.parentCorrelationId,
      operationType: entry.operationType || 'unknown',
      depth: entry.operationDepth || 0,
      startTime: entry.timestamp,
      metadata: {}
    }) : '';

    if (this.config.enableStructuredOutput) {
      console.log(JSON.stringify(entry, null, 2));
    } else {
      const timestamp = entry.timestamp.toISOString();
      const level = entry.level.toUpperCase().padEnd(8);
      const category = entry.category.padEnd(12);
      
      let output = `${timestamp} [${level}] [${category}] ${correlationInfo} ${entry.message}`;
      
      if (entry.data && Object.keys(entry.data).length > 0) {
        output += ` | Data: ${JSON.stringify(entry.data)}`;
      }
      
      // Use appropriate console method based on level
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(output);
          break;
        case LogLevel.INFO:
          console.info(output);
          break;
        case LogLevel.WARN:
          console.warn(output);
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          console.error(output);
          break;
        default:
          console.log(output);
      }
    }
  }

  /**
   * Output to file (placeholder - would require fs module)
   */
  private outputToFile(entry: LogEntry): void {
    // In a real implementation, this would write to file
    // For now, we'll just implement the interface
    const formattedEntry = this.config.enableStructuredOutput 
      ? JSON.stringify(entry) 
      : this.formatEntryAsText(entry);
    
    // Would write formattedEntry to this.config.logFile
  }

  /**
   * Serialize error for logging
   */
  private serializeError(error: Error | ClassifiedError): any {
    const serialized: any = {
      name: error.name,
      message: error.message
    };

    if (this.config.includeStackTraces && error.stack) {
      serialized.stack = error.stack;
    }

    if ('classification' in error) {
      serialized.classification = error.classification;
      serialized.correlationId = error.correlationId;
      serialized.operationType = error.operationType;
    }

    return serialized;
  }

  /**
   * Export logs as CSV
   */
  private exportAsCsv(): string {
    const headers = ['timestamp', 'level', 'category', 'correlationId', 'operationType', 'message'];
    const rows = [headers.join(',')];
    
    for (const entry of this.logEntries) {
      const row = [
        entry.timestamp.toISOString(),
        entry.level,
        entry.category,
        entry.correlationId || '',
        entry.operationType || '',
        `"${entry.message.replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Export logs as text
   */
  private exportAsText(): string {
    return this.logEntries.map(entry => this.formatEntryAsText(entry)).join('\n');
  }

  /**
   * Format log entry as text
   */
  private formatEntryAsText(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const category = entry.category.padEnd(12);
    const correlationInfo = entry.correlationId ? `[${entry.correlationId}]` : '';
    
    return `${timestamp} [${level}] [${category}] ${correlationInfo} ${entry.message}`;
  }
}

/**
 * Convenience function to get logger instance
 */
export function getLogger(config?: Partial<LoggingConfig>): StructuredLogger {
  return StructuredLogger.getInstance(config);
}

/**
 * Decorator for automatic operation logging
 */
export function logOperation(category: LogCategory = LogCategory.OPERATION) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = getLogger();
    
    descriptor.value = async function (...args: any[]) {
      const operationType = `${target.constructor.name}.${propertyName}`;
      
      logger.logOperationStart(operationType, { args: args.length });
      
      try {
        const result = await method.apply(this, args);
        logger.logOperationComplete(operationType, true, { resultType: typeof result });
        return result;
      } catch (error) {
        logger.logOperationComplete(operationType, false, { error: (error as Error).message });
        throw error;
      }
    };
    
    return descriptor;
  };
}