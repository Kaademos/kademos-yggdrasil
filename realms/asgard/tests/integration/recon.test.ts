/**
 * Phase 1 Integration Tests: Reconnaissance Layer
 * Validates that all recon surface is discoverable
 */

import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createInternalRouter } from '../../src/routes/internal';

describe('Phase 1: Reconnaissance Layer', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../../public')));
    app.use('/api/internal', createInternalRouter());
  });

  describe('1. robots.txt Discovery', () => {
    test('should serve robots.txt', async () => {
      const response = await request(app)
        .get('/robots.txt')
        .expect(200);

      expect(response.text).toContain('User-agent: *');
      expect(response.text).toContain('Disallow: /api/internal');
      expect(response.text).toContain('Disallow: /.git');
    });

    test('robots.txt should hint at internal endpoints', async () => {
      const response = await request(app).get('/robots.txt');
      
      expect(response.text).toContain('SPOILER');
      expect(response.text).toContain('/api/internal');
      expect(response.text).toContain('.git');
    });
  });

  describe('2. Git Repository Leak', () => {
    test('.git/config should exist and be readable', () => {
      const configPath = path.join(__dirname, '../../public/.git/config');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('[core]');
      expect(content).toContain('[remote "origin"]');
      expect(content).toContain('SPOILER');
    });

    test('.git/logs/HEAD should contain commit history', () => {
      const logsPath = path.join(__dirname, '../../public/.git/logs/HEAD');
      expect(fs.existsSync(logsPath)).toBe(true);
      
      const content = fs.readFileSync(logsPath, 'utf-8');
      expect(content).toContain('metadata service on port 9090');
      expect(content).toContain('localhost only');
      expect(content).toContain('SPOILER');
    });

    test('commit history should reveal metadata service', () => {
      const logsPath = path.join(__dirname, '../../public/.git/logs/HEAD');
      const content = fs.readFileSync(logsPath, 'utf-8');
      
      // Key commit about metadata service
      expect(content).toMatch(/add internal metadata service/i);
      expect(content).toMatch(/port 9090/);
      expect(content).toMatch(/localhost/i);
    });
  });

  describe('3. SPA Bundle Analysis', () => {
    test('config.js should exist', () => {
      const configPath = path.join(__dirname, '../../public/js/config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    test('config.js should contain commented internal endpoints', () => {
      const configPath = path.join(__dirname, '../../public/js/config.js');
      const content = fs.readFileSync(configPath, 'utf-8');
      
      expect(content).toContain('INTERNAL_ENDPOINTS');
      expect(content).toContain('/api/internal/metadata-service');
      expect(content).toContain('SPOILER');
    });

    test('config.js should reveal metadata service details', () => {
      const configPath = path.join(__dirname, '../../public/js/config.js');
      const content = fs.readFileSync(configPath, 'utf-8');
      
      expect(content).toContain('http://localhost:9090');
      expect(content).toContain('/metadata/secrets');
      expect(content).toContain('SSRF');
    });

    test('api-client.js should exist', () => {
      const apiClientPath = path.join(__dirname, '../../public/js/api-client.js');
      expect(fs.existsSync(apiClientPath)).toBe(true);
    });

    test('api-client.js should have InternalApi class', () => {
      const apiClientPath = path.join(__dirname, '../../public/js/api-client.js');
      const content = fs.readFileSync(apiClientPath, 'utf-8');
      
      expect(content).toContain('class InternalApi');
      expect(content).toContain('getMetadataService');
    });
  });

  describe('4. API Discovery Endpoint', () => {
    test('GET /api/internal/metadata-service should return service info', async () => {
      const response = await request(app)
        .get('/api/internal/metadata-service')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('service', 'metadata');
      expect(response.body).toHaveProperty('url', 'http://localhost:9090');
    });

    test('metadata-service endpoint should list available endpoints', async () => {
      const response = await request(app)
        .get('/api/internal/metadata-service');

      expect(response.body.endpoints).toBeDefined();
      expect(Array.isArray(response.body.endpoints)).toBe(true);
      
      const endpointPaths = response.body.endpoints.map((e: any) => e.path);
      expect(endpointPaths).toContain('/metadata/secrets');
      expect(endpointPaths).toContain('/metadata/config');
      expect(endpointPaths).toContain('/metadata/health');
    });

    test('metadata-service endpoint should hint at SSRF exploitation', async () => {
      const response = await request(app)
        .get('/api/internal/metadata-service');

      expect(response.body.hint).toBeDefined();
      expect(response.body.hint).toContain('Odin-View');
      expect(response.body.hint).toContain('SSRF');
    });

    test('metadata-service endpoint should be publicly accessible (VULNERABLE)', async () => {
      // VULNERABLE: No authentication required
      const response = await request(app)
        .get('/api/internal/metadata-service')
        .expect(200);

      expect(response.body.success).toBe(true);
      // This vulnerability is intentional for Phase 1 recon
    });
  });

  describe('5. Full Recon Chain', () => {
    test('complete recon should discover metadata service URL', async () => {
      // Step 1: Check robots.txt
      const robots = await request(app).get('/robots.txt');
      expect(robots.text).toContain('/api/internal');

      // Step 2: Check .git logs
      const logsPath = path.join(__dirname, '../../public/.git/logs/HEAD');
      const gitLogs = fs.readFileSync(logsPath, 'utf-8');
      expect(gitLogs).toContain('9090');

      // Step 3: Check config.js
      const configPath = path.join(__dirname, '../../public/js/config.js');
      const config = fs.readFileSync(configPath, 'utf-8');
      expect(config).toContain('localhost:9090');

      // Step 4: Call discovery endpoint
      const apiResponse = await request(app).get('/api/internal/metadata-service');
      expect(apiResponse.body.url).toBe('http://localhost:9090');

      // Recon complete: Metadata service discovered at http://localhost:9090
    });
  });
});

describe('Phase 1: Other Internal Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/internal', createInternalRouter());
  });

  test('GET /api/internal/diagnostics should return system info', async () => {
    const response = await request(app)
      .get('/api/internal/diagnostics')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.diagnostics).toBeDefined();
    expect(response.body.diagnostics.uptime).toBeDefined();
  });

  test('GET /api/internal/config should return app config', async () => {
    const response = await request(app)
      .get('/api/internal/config')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.config).toBeDefined();
  });
});
