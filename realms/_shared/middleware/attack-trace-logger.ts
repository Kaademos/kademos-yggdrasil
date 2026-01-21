import * as fs from 'fs';
import * as path from 'path';
import { Request, Response, NextFunction } from 'express';
import { IntentionalError } from './error-handler';

interface AttackTraceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AttackTraceMetadata {
  realm: string;
  cwe?: string;
  cvss?: number;
  timestamp: string;
  exploit_successful: boolean;
  vulnerability_type?: string;
  owasp_category?: string;
  endpoint?: string;
  method?: string;
  [key: string]: any;
}

interface AttackTrace {
  messages: AttackTraceMessage[];
  metadata: AttackTraceMetadata;
}

export interface RealmAttackTraceConfig {
  enabled: boolean;
  realmName: string;
  logPath: string;
  owaspCategory?: string;
  cwe?: string;
  cvss?: number;
}

export class RealmAttackTraceLogger {
  private config: RealmAttackTraceConfig;
  private logDir: string;
  private currentLogFile: string;

  constructor(config: RealmAttackTraceConfig) {
    this.config = {
      enabled: process.env.ATTACK_TRACE_ENABLED !== 'false',
      ...config,
    };

    this.logDir = path.join(
      process.cwd(),
      this.config.logPath || './logs/attack-traces',
      this.config.realmName.toLowerCase()
    );
    this.currentLogFile = this.getLogFileName();

    if (this.config.enabled) {
      this.ensureLogDirectory();
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(date: Date = new Date()): string {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.logDir, `attack-traces-${dateStr}.jsonl`);
  }

  public async logExploit(params: {
    request: Request;
    error: IntentionalError;
    exploitDescription: string;
    vulnerabilityType: string;
  }): Promise<void> {
    if (!this.config.enabled) return;

    const requestInfo = this.formatRequest(params.request);
    const trace: AttackTrace = {
      messages: [
        {
          role: 'system',
          content: `Security analyst identifying vulnerabilities in ${this.config.realmName} realm (${this.config.owaspCategory || 'OWASP vulnerability'})`,
        },
        {
          role: 'user',
          content: `Request: ${params.request.method} ${params.request.path}${requestInfo}`,
        },
        {
          role: 'assistant',
          content: `Vulnerability: ${params.vulnerabilityType}. ${params.exploitDescription}. CWE: ${this.config.cwe || 'Not specified'}. Exploit successful - system leaked sensitive information.`,
        },
      ],
      metadata: {
        realm: this.config.realmName.toUpperCase(),
        cwe: this.config.cwe,
        cvss: this.config.cvss,
        timestamp: new Date().toISOString(),
        exploit_successful: true,
        vulnerability_type: params.vulnerabilityType,
        owasp_category: this.config.owaspCategory,
        endpoint: params.request.path,
        method: params.request.method,
        status_code: params.error.statusCode || 500,
      },
    };

    await this.writeTrace(trace);
  }

  public async logFailedAttempt(params: {
    request: Request;
    reason: string;
  }): Promise<void> {
    if (!this.config.enabled) return;

    const requestInfo = this.formatRequest(params.request);
    const trace: AttackTrace = {
      messages: [
        {
          role: 'system',
          content: `Security analyst identifying vulnerabilities in ${this.config.realmName} realm`,
        },
        {
          role: 'user',
          content: `Request: ${params.request.method} ${params.request.path}${requestInfo}`,
        },
        {
          role: 'assistant',
          content: `Attack attempt detected but unsuccessful. Reason: ${params.reason}. No vulnerability exploited.`,
        },
      ],
      metadata: {
        realm: this.config.realmName.toUpperCase(),
        timestamp: new Date().toISOString(),
        exploit_successful: false,
        endpoint: params.request.path,
        method: params.request.method,
        failure_reason: params.reason,
      },
    };

    await this.writeTrace(trace);
  }

  private formatRequest(req: Request): string {
    const parts: string[] = [];

    if (Object.keys(req.query).length > 0) {
      parts.push(`Query: ${JSON.stringify(this.sanitize(req.query))}`);
    }

    if (req.body && Object.keys(req.body).length > 0) {
      parts.push(`Body: ${JSON.stringify(this.sanitize(req.body))}`);
    }

    if (req.headers && req.headers['user-agent']) {
      parts.push(`User-Agent: ${req.headers['user-agent']}`);
    }

    return parts.length > 0 ? `. ${parts.join(', ')}` : '';
  }

  private sanitize(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
    const sanitized: any = Array.isArray(data) ? [] : {};

    for (const key in data) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof data[key] === 'object') {
        sanitized[key] = this.sanitize(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }

    return sanitized;
  }

  private async writeTrace(trace: AttackTrace): Promise<void> {
    try {
      const newLogFile = this.getLogFileName();
      if (newLogFile !== this.currentLogFile) {
        this.currentLogFile = newLogFile;
      }

      const jsonLine = JSON.stringify(trace) + '\n';
      await fs.promises.appendFile(this.currentLogFile, jsonLine, 'utf-8');
    } catch (err) {
      console.error(`Error writing attack trace for ${this.config.realmName}:`, err);
    }
  }
}

/**
 * Middleware factory to create attack trace logging middleware for a realm
 */
export function createAttackTraceMiddleware(config: RealmAttackTraceConfig) {
  const logger = new RealmAttackTraceLogger(config);

  return {
    /**
     * Log successful exploits (should be called when IntentionalError is caught)
     */
    logExploit: async (
      req: Request,
      error: IntentionalError,
      exploitDescription: string,
      vulnerabilityType: string
    ) => {
      await logger.logExploit({
        request: req,
        error,
        exploitDescription,
        vulnerabilityType,
      });
    },

    /**
     * Log failed attack attempts
     */
    logFailedAttempt: async (req: Request, reason: string) => {
      await logger.logFailedAttempt({ request: req, reason });
    },

    /**
     * Middleware to log all requests to this realm
     */
    middleware: (req: Request, res: Response, next: NextFunction) => {
      // Store original end function
      const originalEnd = res.end;

      // Override end to capture response
      res.end = function (this: Response, ...args: any[]): Response {
        // Log trace based on response status
        if (res.statusCode === 500 || res.statusCode === 400) {
          // Potential exploit attempt - will be logged by error handler
        }

        // Call original end
        return originalEnd.apply(this, args);
      };

      next();
    },
  };
}
