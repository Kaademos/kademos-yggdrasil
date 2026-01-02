/**
 * Phase 5 Integration Tests: Metadata Service
 * Tests internal metadata service on localhost:9090
 */

import request from 'supertest';
import express from 'express';
import { createMetadataRouter } from '../../src/routes/metadata';
import { RealmConfig } from '../../src/config';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    end: jest.fn()
  };
  return {
    Pool: jest.fn(() => mockPool)
  };
});

describe('Phase 5: Metadata Service', () => {
  let app: express.Application;
  let mockPool: any;

  const mockConfig: RealmConfig = {
    port: 3000,
    flag: 'YGGDRASIL{ASGARD:test-flag}',
    realmName: 'asgard',
    nodeEnv: 'test',
    databaseUrl: 'postgresql://test:test@localhost:5432/asgard'
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/metadata', createMetadataRouter(mockConfig));

    // Get mock pool instance
    mockPool = new Pool();
    jest.clearAllMocks();
  });

  describe('1. Metadata Service Root', () => {
    test('GET /metadata/ should list endpoints', async () => {
      const response = await request(app)
        .get('/metadata/')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('asgard-metadata');
      expect(response.body.endpoints).toBeDefined();
      expect(Array.isArray(response.body.endpoints)).toBe(true);
    });

    test('should list all available endpoints', async () => {
      const response = await request(app).get('/metadata/');

      const endpointPaths = response.body.endpoints.map((e: any) => e.path);
      expect(endpointPaths).toContain('/metadata/');
      expect(endpointPaths).toContain('/metadata/secrets');
      expect(endpointPaths).toContain('/metadata/config');
      expect(endpointPaths).toContain('/metadata/health');
    });

    test('should indicate service is internal only', async () => {
      const response = await request(app).get('/metadata/');

      expect(response.body.note).toContain('internal');
    });
  });

  describe('2. Secrets Endpoint (FLAG HERE)', () => {
    test('GET /metadata/secrets should return secrets', async () => {
      const mockSecrets = [
        {
          id: 1,
          secret_type: 'flag',
          secret_key: 'asgard_master_key',
          secret_value: 'YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}',
          created_at: '2025-12-13T00:00:00.000Z'
        },
        {
          id: 3,
          secret_type: 'system',
          secret_key: 'metadata_service_url',
          secret_value: 'http://localhost:9090',
          created_at: '2025-12-13T00:00:00.000Z'
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockSecrets });

      const response = await request(app)
        .get('/metadata/secrets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('internal-metadata');
      expect(response.body.secrets).toEqual(mockSecrets);
    });

    test('FLAG HERE: first secret should be Asgard flag', async () => {
      const mockFlag = 'YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}';
      mockPool.query.mockResolvedValue({
        rows: [
          {
            secret_type: 'flag',
            secret_key: 'asgard_master_key',
            secret_value: mockFlag
          }
        ]
      });

      const response = await request(app).get('/metadata/secrets');

      expect(response.body.secrets[0].secret_value).toBe(mockFlag);
      expect(response.body.secrets[0].secret_type).toBe('flag');
      expect(response.body.secrets[0].secret_value).toMatch(/^YGGDRASIL\{ASGARD:[a-f0-9-]+\}$/);
    });

    test('should query secrets from database', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/metadata/secrets');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM secrets WHERE secret_type IN ($1, $2) ORDER BY id',
        ['flag', 'system']
      );
    });

    test('should indicate SSRF-only access', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/metadata/secrets');

      expect(response.body.note).toContain('SSRF');
    });

    test('should warn about sensitive content', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/metadata/secrets');

      expect(response.body.warning).toBeDefined();
      expect(response.body.warning).toMatch(/sensitive|secret/i);
    });

    test('should handle database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/metadata/secrets')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('3. Config Endpoint', () => {
    test('GET /metadata/config should return configuration', async () => {
      const response = await request(app)
        .get('/metadata/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toBeDefined();
    });

    test('should expose service configuration', async () => {
      const response = await request(app).get('/metadata/config');

      const config = response.body.config;
      expect(config.service).toBe('metadata');
      expect(config.realm).toBe('asgard');
      expect(config.port).toBe(9090);
      expect(config.host).toBe('127.0.0.1');
    });

    test('should hide database credentials', async () => {
      const response = await request(app).get('/metadata/config');

      const config = response.body.config;
      expect(config.database).not.toContain('test:test'); // Password hidden
      expect(config.database).toBeDefined();
    });

    test('should list enabled features', async () => {
      const response = await request(app).get('/metadata/config');

      const features = response.body.config.features;
      expect(features.secretsManagement).toBe(true);
      expect(features.flagStorage).toBe(true);
      expect(features.configurationApi).toBe(true);
    });
  });

  describe('4. Health Check', () => {
    test('GET /metadata/health should return healthy status', async () => {
      const response = await request(app)
        .get('/metadata/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('metadata');
      expect(response.body.status).toBe('healthy');
    });

    test('should include uptime', async () => {
      const response = await request(app).get('/metadata/health');

      expect(response.body.uptime).toBeDefined();
      expect(typeof response.body.uptime).toBe('number');
    });

    test('should include timestamp', async () => {
      const response = await request(app).get('/metadata/health');

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('5. Full Exploit Chain (Phase 4→5)', () => {
    test('complete SSRF → Metadata → FLAG extraction', async () => {
      // Phase 4: SSRF bypassed filter using IPv6 notation
      // Now accessing metadata service

      const mockFlag = 'YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}';
      const mockSecrets = [
        {
          id: 1,
          secret_type: 'flag',
          secret_key: 'asgard_master_key',
          secret_value: mockFlag,
          created_at: '2025-12-13T00:00:00.000Z'
        },
        {
          id: 2,
          secret_type: 'api_key',
          secret_key: 'bifrost_gateway',
          secret_value: 'BF-KEY-2025-RAINBOW-BRIDGE-ACCESS',
          created_at: '2025-12-13T00:00:00.000Z'
        },
        {
          id: 3,
          secret_type: 'system',
          secret_key: 'metadata_service_url',
          secret_value: 'http://localhost:9090',
          created_at: '2025-12-13T00:00:00.000Z'
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockSecrets });

      // Access metadata secrets endpoint
      const response = await request(app).get('/metadata/secrets');

      expect(response.body.success).toBe(true);
      expect(response.body.secrets).toHaveLength(3);

      // Extract flag
      const flagSecret = response.body.secrets.find(
        (s: any) => s.secret_type === 'flag'
      );

      expect(flagSecret).toBeDefined();
      expect(flagSecret.secret_value).toBe(mockFlag);
      expect(flagSecret.secret_value).toMatch(/^YGGDRASIL\{ASGARD:[a-f0-9-]+\}$/);

      // Flag extracted successfully!
      console.log('[Test] FLAG EXTRACTED:', flagSecret.secret_value);
    });
  });

  describe('6. Service Isolation', () => {
    test('metadata service should only be reachable via SSRF', async () => {
      // This test documents that the metadata service:
      // 1. Runs on localhost:9090 (127.0.0.1)
      // 2. Is NOT exposed to Docker host
      // 3. Requires SSRF bypass to access

      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/metadata/secrets');

      expect(response.body.note).toContain('SSRF');
      // In real deployment, direct access would fail
      // Only accessible through Odin-View with SSRF bypass
    });
  });

  describe('7. Database Connection Handling', () => {
    test('should create new pool for each request', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/metadata/secrets');

      expect(Pool).toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalled();
      expect(mockPool.end).toHaveBeenCalled();
    });

    test('should close pool after query', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/metadata/secrets');

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});
