import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { AttackTraceLogger } from '../src/services/attack-trace-logger';

const TEST_LOG_PATH = './test-logs/attack-traces';

describe('AttackTraceLogger', () => {
  let logger: AttackTraceLogger;
  let testLogDir: string;

  beforeEach(() => {
    // Create test logger with isolated log directory
    logger = new AttackTraceLogger({
      enabled: true,
      logPath: TEST_LOG_PATH,
      format: 'openai',
      rotationEnabled: false,
      maxAgeDays: 30,
    });

    testLogDir = path.join(process.cwd(), TEST_LOG_PATH, 'gatekeeper');
  });

  afterEach(async () => {
    // Clean up test logs
    await logger.flush();
    if (fs.existsSync(testLogDir)) {
      const files = fs.readdirSync(testLogDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testLogDir, file));
      }
      fs.rmdirSync(testLogDir);
    }
  });

  describe('constructor', () => {
    it('should create log directory if it does not exist', () => {
      expect(fs.existsSync(testLogDir)).toBe(true);
    });

    it('should use default configuration from environment', () => {
      const config = logger.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.format).toBe('openai');
    });

    it('should respect ATTACK_TRACE_ENABLED=false', () => {
      process.env.ATTACK_TRACE_ENABLED = 'false';
      const disabledLogger = new AttackTraceLogger();
      expect(disabledLogger.getConfig().enabled).toBe(false);
      delete process.env.ATTACK_TRACE_ENABLED;
    });
  });

  describe('logAuthAttempt', () => {
    it('should log successful authentication in OpenAI format', async () => {
      await logger.logAuthAttempt({
        username: 'testuser',
        success: true,
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      expect(logFiles.length).toBe(1);

      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages).toHaveLength(3);
      expect(trace.messages[0].role).toBe('system');
      expect(trace.messages[1].role).toBe('user');
      expect(trace.messages[1].content).toContain('testuser');
      expect(trace.messages[2].role).toBe('assistant');
      expect(trace.messages[2].content).toContain('successful');

      expect(trace.metadata.timestamp).toBeDefined();
      expect(trace.metadata.exploit_successful).toBe(true);
      expect(trace.metadata.ip_address).toBe('127.0.0.1');
      expect(trace.metadata.event_type).toBe('authentication');
    });

    it('should log failed authentication with reason', async () => {
      await logger.logAuthAttempt({
        username: 'attacker',
        success: false,
        ip: '192.168.1.100',
        reason: 'Invalid credentials',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages[2].content).toContain('failed');
      expect(trace.messages[2].content).toContain('Invalid credentials');
      expect(trace.metadata.exploit_successful).toBe(false);
    });

    it('should detect SQL injection attempts in username', async () => {
      await logger.logAuthAttempt({
        username: "admin' OR '1'='1",
        success: false,
        ip: '10.0.0.1',
        reason: 'Invalid credentials',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages[2].content).toContain('SQL injection attempt');
    });

    it('should detect XSS attempts in username', async () => {
      await logger.logAuthAttempt({
        username: '<script>alert(1)</script>',
        success: false,
        ip: '10.0.0.1',
        reason: 'Invalid credentials',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages[2].content).toContain('XSS attempt');
    });
  });

  describe('logFlagSubmission', () => {
    it('should log successful flag submission', async () => {
      await logger.logFlagSubmission({
        userId: 'user123',
        flag: 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}',
        realm: 'NIFLHEIM',
        success: true,
        unlockedRealm: 'HELHEIM',
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages).toHaveLength(3);
      expect(trace.messages[1].content).toContain('NIFLHEIM');
      expect(trace.messages[1].content).toContain('YGGDRASIL{NIFLHEIM:');
      expect(trace.messages[2].content).toContain('Exploit successful');
      expect(trace.messages[2].content).toContain('HELHEIM');

      expect(trace.metadata.realm).toBe('NIFLHEIM');
      expect(trace.metadata.exploit_successful).toBe(true);
      expect(trace.metadata.unlocked_realm).toBe('HELHEIM');
      expect(trace.metadata.event_type).toBe('flag_submission');
    });

    it('should log failed flag submission', async () => {
      await logger.logFlagSubmission({
        userId: 'user123',
        flag: 'INVALID_FLAG',
        realm: 'NIFLHEIM',
        success: false,
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages[2].content).toContain('Invalid flag');
      expect(trace.metadata.exploit_successful).toBe(false);
      expect(trace.metadata.unlocked_realm).toBeUndefined();
    });

    it('should truncate flag in logs for security', async () => {
      const longFlag = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}';
      
      await logger.logFlagSubmission({
        userId: 'user123',
        flag: longFlag,
        realm: 'NIFLHEIM',
        success: true,
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      // Should only show first 30 chars
      expect(trace.messages[1].content).toContain(longFlag.substring(0, 30));
      expect(trace.messages[1].content).not.toContain(longFlag);
    });
  });

  describe('logRealmAccess', () => {
    it('should log authorized realm access', async () => {
      await logger.logRealmAccess({
        userId: 'user123',
        realm: 'NIFLHEIM',
        allowed: true,
        userLevel: 10,
        requiredLevel: 10,
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages[2].content).toContain('Access granted');
      expect(trace.metadata.exploit_successful).toBe(false); // Authorized access is not an exploit
      expect(trace.metadata.user_level).toBe(10);
      expect(trace.metadata.required_level).toBe(10);
    });

    it('should log unauthorized realm access attempt', async () => {
      await logger.logRealmAccess({
        userId: 'user123',
        realm: 'ASGARD',
        allowed: false,
        userLevel: 5,
        requiredLevel: 1,
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const trace = JSON.parse(logContent);

      expect(trace.messages[2].content).toContain('Access denied');
      expect(trace.messages[2].content).toContain('IDOR');
      expect(trace.metadata.exploit_successful).toBe(true); // Unauthorized access attempt is an attack
      expect(trace.metadata.owasp_category).toBe('A01:2021 - Broken Access Control');
    });
  });

  describe('sanitization', () => {
    it('should sanitize session IDs in metadata', async () => {
      const trace = {
        messages: [
          { role: 'system' as const, content: 'test' },
          { role: 'user' as const, content: 'test' },
          { role: 'assistant' as const, content: 'test' },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          exploit_successful: true,
          session_id: 'very-long-session-id-12345678',
        },
      };

      await logger.logTrace(trace);
      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const sanitized = JSON.parse(logContent);

      expect(sanitized.metadata.session_id).toBe('very-lon...');
      expect(sanitized.metadata.session_id).not.toBe('very-long-session-id-12345678');
    });
  });

  describe('high-volume logging', () => {
    it('should handle multiple concurrent logs without blocking', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          logger.logAuthAttempt({
            username: `user${i}`,
            success: i % 2 === 0,
            ip: '127.0.0.1',
          })
        );
      }

      await Promise.all(promises);
      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const lines = logContent.trim().split('\n');

      expect(lines.length).toBe(100);
    });
  });

  describe('JSONL format', () => {
    it('should write logs in valid JSONL format', async () => {
      await logger.logAuthAttempt({
        username: 'user1',
        success: true,
        ip: '127.0.0.1',
      });

      await logger.logFlagSubmission({
        userId: 'user1',
        flag: 'YGGDRASIL{TEST:00000000-0000-0000-0000-000000000000}',
        realm: 'TEST',
        success: true,
        ip: '127.0.0.1',
      });

      await logger.flush();

      const logFiles = fs.readdirSync(testLogDir);
      const logContent = fs.readFileSync(path.join(testLogDir, logFiles[0]), 'utf-8');
      const lines = logContent.trim().split('\n');

      expect(lines.length).toBe(2);

      // Each line should be valid JSON
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('disabled logger', () => {
    it('should not write logs when disabled', async () => {
      const disabledLogger = new AttackTraceLogger({
        enabled: false,
        logPath: TEST_LOG_PATH,
      });

      await disabledLogger.logAuthAttempt({
        username: 'testuser',
        success: true,
        ip: '127.0.0.1',
      });

      await disabledLogger.flush();

      const logFiles = fs.existsSync(testLogDir) ? fs.readdirSync(testLogDir) : [];
      expect(logFiles.length).toBe(0);
    });
  });
});
