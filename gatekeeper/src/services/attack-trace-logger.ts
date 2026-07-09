import * as fs from 'fs';
import * as path from 'path';
import { sanitizeForLogging } from '../utils/logger';

export interface AttackTraceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AttackTraceMetadata {
  realm?: string;
  cwe?: string;
  cvss?: number;
  timestamp: string;
  exploit_successful: boolean;
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  owasp_category?: string;
  [key: string]: any;
}

export interface AttackTrace {
  messages: AttackTraceMessage[];
  metadata: AttackTraceMetadata;
}

export interface AttackTraceConfig {
  enabled: boolean;
  logPath: string;
  format: 'openai' | 'generic';
  rotationEnabled: boolean;
  maxAgeDays: number;
}

export class AttackTraceLogger {
  private config: AttackTraceConfig;
  private logDir: string;
  private currentLogFile: string;
  private writeQueue: AttackTrace[] = [];
  private isProcessing = false;

  constructor(config?: Partial<AttackTraceConfig>) {
    this.config = {
      enabled: process.env.ATTACK_TRACE_ENABLED !== 'false',
      logPath: process.env.ATTACK_TRACE_PATH || './logs/attack-traces',
      format: (process.env.ATTACK_TRACE_FORMAT as 'openai' | 'generic') || 'openai',
      rotationEnabled: true,
      maxAgeDays: 30,
      ...config,
    };

    this.logDir = path.join(process.cwd(), this.config.logPath, 'gatekeeper');
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

  private async rotateLogsIfNeeded(): Promise<void> {
    if (!this.config.rotationEnabled) return;

    const newLogFile = this.getLogFileName();
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
    }

    // Clean up old logs
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxAgeDays);

    try {
      const files = fs.readdirSync(this.logDir);
      for (const file of files) {
        if (!file.startsWith('attack-traces-') || !file.endsWith('.jsonl')) {
          continue;
        }

        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error('Error rotating logs:', err);
    }
  }

  public async logTrace(trace: AttackTrace): Promise<void> {
    if (!this.config.enabled) return;

    // Sanitize sensitive data
    const sanitizedTrace = this.sanitizeTrace(trace);

    // Add to queue
    this.writeQueue.push(sanitizedTrace);

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private sanitizeTrace(trace: AttackTrace): AttackTrace {
    const sanitized: AttackTrace = {
      messages: trace.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      metadata: { ...trace.metadata },
    };

    // Remove sensitive fields from metadata
    if (sanitized.metadata.session_id) {
      sanitized.metadata.session_id = sanitized.metadata.session_id.substring(0, 8) + '...';
    }

    // Sanitize any nested objects
    for (const key in sanitized.metadata) {
      if (typeof sanitized.metadata[key] === 'object' && sanitized.metadata[key] !== null) {
        sanitized.metadata[key] = sanitizeForLogging(sanitized.metadata[key]);
      }
    }

    return sanitized;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.writeQueue.length === 0) return;

    this.isProcessing = true;

    try {
      await this.rotateLogsIfNeeded();

      while (this.writeQueue.length > 0) {
        const trace = this.writeQueue.shift()!;
        const jsonLine = JSON.stringify(trace) + '\n';

        await fs.promises.appendFile(this.currentLogFile, jsonLine, 'utf-8');
      }
    } catch (err) {
      console.error('Error writing attack trace:', err);
      // Put failed traces back in queue
      if (this.writeQueue.length > 1000) {
        // Prevent memory issues - drop oldest traces
        this.writeQueue = this.writeQueue.slice(-1000);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async logAuthAttempt(params: {
    username: string;
    success: boolean;
    ip: string;
    reason?: string;
  }): Promise<void> {
    const trace: AttackTrace = {
      messages: [
        {
          role: 'system',
          content: 'Security analyst monitoring authentication attempts in a CTF platform',
        },
        {
          role: 'user',
          content: `Authentication attempt: username="${params.username}", from IP ${params.ip}`,
        },
        {
          role: 'assistant',
          content: params.success
            ? `Login successful for user "${params.username}". User authenticated and session created.`
            : `Login failed for user "${params.username}". Reason: ${params.reason || 'Invalid credentials'}. Possible attack indicators: ${this.getAuthAttackIndicators(params)}`,
        },
      ],
      metadata: {
        timestamp: new Date().toISOString(),
        exploit_successful: params.success,
        ip_address: params.ip,
        event_type: 'authentication',
        owasp_category: 'A07:2021 - Identification and Authentication Failures',
      },
    };

    await this.logTrace(trace);
  }

  private getAuthAttackIndicators(params: { username: string; reason?: string }): string {
    const indicators: string[] = [];

    if (params.username.includes("'") || params.username.includes('"')) {
      indicators.push('SQL injection attempt in username');
    }
    if (params.username.includes('<script>')) {
      indicators.push('XSS attempt in username');
    }
    if (params.reason?.includes('rate limit')) {
      indicators.push('Brute force attack detected');
    }

    return indicators.length > 0 ? indicators.join(', ') : 'None detected';
  }

  public async logFlagSubmission(params: {
    userId: string;
    flag: string;
    realm: string;
    success: boolean;
    unlockedRealm?: string;
    ip: string;
  }): Promise<void> {
    const trace: AttackTrace = {
      messages: [
        {
          role: 'system',
          content: 'Security analyst tracking CTF progress and exploit success',
        },
        {
          role: 'user',
          content: `Flag submission for realm ${params.realm}: "${params.flag.substring(0, 30)}..."`,
        },
        {
          role: 'assistant',
          content: params.success
            ? `Valid flag submitted for ${params.realm}. Exploit successful. ${params.unlockedRealm ? `Unlocked next realm: ${params.unlockedRealm}` : 'All realms completed!'}`
            : `Invalid flag for ${params.realm}. Either incorrect flag format, tampered flag, or flag belongs to different realm.`,
        },
      ],
      metadata: {
        timestamp: new Date().toISOString(),
        exploit_successful: params.success,
        realm: params.realm,
        user_id: params.userId,
        ip_address: params.ip,
        event_type: 'flag_submission',
        unlocked_realm: params.unlockedRealm,
      },
    };

    await this.logTrace(trace);
  }

  public async logRealmAccess(params: {
    userId: string;
    realm: string;
    allowed: boolean;
    userLevel: number;
    requiredLevel: number;
    ip: string;
  }): Promise<void> {
    const trace: AttackTrace = {
      messages: [
        {
          role: 'system',
          content: 'Security analyst monitoring access control in a CTF platform',
        },
        {
          role: 'user',
          content: `Realm access attempt: User (level ${params.userLevel}) attempting to access ${params.realm} (requires level ${params.requiredLevel})`,
        },
        {
          role: 'assistant',
          content: params.allowed
            ? `Access granted to ${params.realm}. User has completed prerequisites.`
            : `Access denied to ${params.realm}. Potential IDOR/privilege escalation attempt. User must complete level ${params.requiredLevel} first.`,
        },
      ],
      metadata: {
        timestamp: new Date().toISOString(),
        exploit_successful: !params.allowed, // Unauthorized access is the "attack"
        realm: params.realm,
        user_id: params.userId,
        ip_address: params.ip,
        event_type: 'access_control',
        owasp_category: 'A01:2021 - Broken Access Control',
        user_level: params.userLevel,
        required_level: params.requiredLevel,
      },
    };

    await this.logTrace(trace);
  }

  public async flush(): Promise<void> {
    if (this.writeQueue.length > 0) {
      await this.processQueue();
    }
  }

  public getConfig(): AttackTraceConfig {
    return { ...this.config };
  }
}

// Singleton instance for global use
export const attackTraceLogger = new AttackTraceLogger();
