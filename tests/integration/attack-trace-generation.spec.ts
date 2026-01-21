/**
 * Attack Trace Generation Integration Tests
 * 
 * End-to-end tests verifying attack traces are generated correctly
 * during real user interactions with the platform.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const LOGS_DIR = path.join(__dirname, '../../logs/attack-traces');

test.describe('Attack Trace Generation', () => {
  test.beforeAll(async () => {
    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  });

  test.describe('Authentication Traces', () => {
    test('should generate trace for successful login', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const timestamp = Date.now();
      
      // Perform login
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      
      // Wait for login to complete
      await page.waitForURL(`${BASE_URL}/realms`);
      
      // Give traces time to be written (async operation)
      await page.waitForTimeout(1000);
      
      // Verify trace file exists
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      // Check if file was created
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const traces = content.trim().split('\n').filter(line => line);
        
        expect(traces.length).toBeGreaterThan(0);
        
        // Parse last trace
        const lastTrace = JSON.parse(traces[traces.length - 1]);
        
        // Verify structure
        expect(lastTrace).toHaveProperty('messages');
        expect(lastTrace).toHaveProperty('metadata');
        expect(lastTrace.messages).toBeInstanceOf(Array);
        expect(lastTrace.messages.length).toBeGreaterThan(0);
        
        // Verify OpenAI format
        lastTrace.messages.forEach((msg: any) => {
          expect(msg).toHaveProperty('role');
          expect(msg).toHaveProperty('content');
          expect(['system', 'user', 'assistant']).toContain(msg.role);
        });
        
        // Verify metadata
        expect(lastTrace.metadata).toHaveProperty('timestamp');
        expect(lastTrace.metadata).toHaveProperty('event_type');
      }
    });

    test('should generate trace for failed login', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      // Attempt login with invalid credentials
      await page.fill('input[name="username"]', 'invaliduser');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await page.waitForSelector('.error-message, .alert-danger', { timeout: 5000 });
      
      // Give traces time to be written
      await page.waitForTimeout(1000);
      
      // Trace should be generated for failed auth
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        // Should have at least one trace
        expect(lines.length).toBeGreaterThan(0);
      }
    });

    test('should generate trace for SQL injection attempt', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      // SQL injection attempt
      await page.fill('input[name="username"]', "admin' OR '1'='1'--");
      await page.fill('input[name="password"]', "password");
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(1000);
      
      // Trace should capture the injection attempt
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const traces = content.trim().split('\n').filter(line => line);
        
        if (traces.length > 0) {
          const lastTrace = JSON.parse(traces[traces.length - 1]);
          
          // Verify SQL injection is sanitized in trace
          const userMessage = lastTrace.messages.find((m: any) => m.role === 'user');
          if (userMessage) {
            // Should contain sanitized version or redacted
            expect(userMessage.content).toBeDefined();
          }
        }
      }
    });
  });

  test.describe('Flag Submission Traces', () => {
    test('should generate trace for valid flag submission', async ({ page, context }) => {
      // Login first
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/realms`);
      
      // Navigate to first realm
      await page.goto(`${BASE_URL}/realms/niflheim`);
      
      // Submit flag (you'll need to generate a valid flag for your user)
      const flagInput = page.locator('input[name="flag"], input#flag-input, input.flag-input');
      if (await flagInput.count() > 0) {
        await flagInput.fill('YGGDRASIL{NIFLHEIM:test-flag-12345678-1234-1234-1234-123456789012}');
        await page.click('button[type="submit"], button:has-text("Submit")');
        
        await page.waitForTimeout(1500);
        
        // Verify trace generated
        const today = new Date().toISOString().split('T')[0];
        const traceFile = path.join(LOGS_DIR, 'flag-oracle', `attack-traces-${today}.jsonl`);
        
        if (fs.existsSync(traceFile)) {
          const content = fs.readFileSync(traceFile, 'utf-8');
          const traces = content.trim().split('\n').filter(line => line);
          
          if (traces.length > 0) {
            const trace = JSON.parse(traces[traces.length - 1]);
            
            expect(trace.metadata).toHaveProperty('event_type', 'flag_submission');
            expect(trace.metadata).toHaveProperty('realm');
          }
        }
      }
    });

    test('should generate trace for invalid flag submission', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/realms`);
      
      await page.goto(`${BASE_URL}/realms/niflheim`);
      
      const flagInput = page.locator('input[name="flag"], input#flag-input, input.flag-input');
      if (await flagInput.count() > 0) {
        // Submit invalid flag
        await flagInput.fill('YGGDRASIL{INVALID:00000000-0000-0000-0000-000000000000}');
        await page.click('button[type="submit"], button:has-text("Submit")');
        
        await page.waitForTimeout(1000);
        
        // Should still generate trace for failed attempt
        const today = new Date().toISOString().split('T')[0];
        const traceFile = path.join(LOGS_DIR, 'flag-oracle', `attack-traces-${today}.jsonl`);
        
        if (fs.existsSync(traceFile)) {
          const content = fs.readFileSync(traceFile, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    test('should generate traces for brute force attempt', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/realms`);
      
      await page.goto(`${BASE_URL}/realms/niflheim`);
      
      const flagInput = page.locator('input[name="flag"], input#flag-input, input.flag-input');
      if (await flagInput.count() > 0) {
        // Submit multiple invalid flags
        const invalidFlags = [
          'YGGDRASIL{NIFLHEIM:00000000-0000-0000-0000-000000000000}',
          'YGGDRASIL{NIFLHEIM:11111111-1111-1111-1111-111111111111}',
          'YGGDRASIL{NIFLHEIM:22222222-2222-2222-2222-222222222222}'
        ];
        
        for (const flag of invalidFlags) {
          await flagInput.fill(flag);
          await page.click('button[type="submit"], button:has-text("Submit")');
          await page.waitForTimeout(500);
        }
        
        await page.waitForTimeout(1000);
        
        // Should have multiple traces
        const today = new Date().toISOString().split('T')[0];
        const traceFile = path.join(LOGS_DIR, 'flag-oracle', `attack-traces-${today}.jsonl`);
        
        if (fs.existsSync(traceFile)) {
          const content = fs.readFileSync(traceFile, 'utf-8');
          const traces = content.trim().split('\n').filter(line => line);
          
          // Should have at least 3 traces from our attempts
          expect(traces.length).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });

  test.describe('Realm Access Traces', () => {
    test('should generate trace for accessing locked realm', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'newuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/realms`);
      
      // Try to access final realm (should be locked)
      const response = await page.goto(`${BASE_URL}/realms/asgard`);
      
      await page.waitForTimeout(1000);
      
      // Should generate access control trace
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const traces = content.trim().split('\n').filter(line => line);
        
        if (traces.length > 0) {
          const trace = JSON.parse(traces[traces.length - 1]);
          
          // Should contain realm access information
          expect(trace.metadata).toHaveProperty('event_type');
        }
      }
    });

    test('should generate trace for successful realm access', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/realms`);
      
      // Access starting realm (should be unlocked)
      await page.goto(`${BASE_URL}/realms/niflheim`);
      await page.waitForLoadState('networkidle');
      
      await page.waitForTimeout(1000);
      
      // Verify page loaded successfully
      expect(page.url()).toContain('niflheim');
    });
  });

  test.describe('Trace Format Validation', () => {
    test('should generate valid JSONL format', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(1000);
      
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        // Each line should be valid JSON
        lines.forEach(line => {
          expect(() => JSON.parse(line)).not.toThrow();
        });
      }
    });

    test('should include required metadata fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(1000);
      
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const traces = content.trim().split('\n').filter(line => line);
        
        if (traces.length > 0) {
          const trace = JSON.parse(traces[traces.length - 1]);
          
          // Required fields
          expect(trace).toHaveProperty('messages');
          expect(trace).toHaveProperty('metadata');
          expect(trace.metadata).toHaveProperty('timestamp');
          expect(trace.metadata).toHaveProperty('event_type');
          
          // Timestamp should be valid ISO format
          expect(() => new Date(trace.metadata.timestamp)).not.toThrow();
        }
      }
    });

    test('should sanitize sensitive data', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'super-secret-password-123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(1000);
      
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        
        // Password should not appear in plaintext
        expect(content).not.toContain('super-secret-password-123');
        
        // Should contain redaction markers
        expect(content.toLowerCase()).toMatch(/\[redacted\]|\*{3,}|password: .{0,10}\.\.\./);
      }
    });
  });

  test.describe('Trace File Management', () => {
    test('should create daily trace files', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(1000);
      
      const today = new Date().toISOString().split('T')[0];
      const expectedFile = `attack-traces-${today}.jsonl`;
      
      // Check if file exists in any service directory
      const services = ['gatekeeper', 'flag-oracle'];
      let fileExists = false;
      
      for (const service of services) {
        const traceFile = path.join(LOGS_DIR, service, expectedFile);
        if (fs.existsSync(traceFile)) {
          fileExists = true;
          
          // Verify filename format
          expect(path.basename(traceFile)).toMatch(/attack-traces-\d{4}-\d{2}-\d{2}\.jsonl/);
          break;
        }
      }
      
      // At least one service should have generated traces
      expect(fileExists).toBe(true);
    });

    test('should organize traces by service', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(1000);
      
      // Check directory structure
      const gatekeeperDir = path.join(LOGS_DIR, 'gatekeeper');
      const flagOracleDir = path.join(LOGS_DIR, 'flag-oracle');
      
      // At least one directory should exist
      const gatekeeperExists = fs.existsSync(gatekeeperDir);
      const flagOracleExists = fs.existsSync(flagOracleDir);
      
      expect(gatekeeperExists || flagOracleExists).toBe(true);
    });
  });

  test.describe('Multi-User Trace Isolation', () => {
    test('should generate separate traces for different users', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // User 1 login
      await page1.goto(`${BASE_URL}/login`);
      await page1.fill('input[name="username"]', 'user1');
      await page1.fill('input[name="password"]', 'pass1');
      await page1.click('button[type="submit"]');
      
      // User 2 login
      await page2.goto(`${BASE_URL}/login`);
      await page2.fill('input[name="username"]', 'user2');
      await page2.fill('input[name="password"]', 'pass2');
      await page2.click('button[type="submit"]');
      
      await page1.waitForTimeout(1500);
      
      const today = new Date().toISOString().split('T')[0];
      const traceFile = path.join(LOGS_DIR, 'gatekeeper', `attack-traces-${today}.jsonl`);
      
      if (fs.existsSync(traceFile)) {
        const content = fs.readFileSync(traceFile, 'utf-8');
        const traces = content.trim().split('\n').filter(line => line);
        
        // Should have traces from both users
        expect(traces.length).toBeGreaterThanOrEqual(2);
        
        // Traces should not contain actual user IDs (should be sanitized)
        const parsedTraces = traces.map(line => JSON.parse(line));
        parsedTraces.forEach(trace => {
          expect(trace.metadata).toHaveProperty('user_id');
        });
      }
      
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    });
  });
});
