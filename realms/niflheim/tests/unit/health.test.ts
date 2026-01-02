/**
 * Niflheim Health Route Unit Tests
 */

import express from 'express';
import request from 'supertest';
import { createHealthRouter } from '../../src/routes/health';
import { RealmConfig } from '../../src/config';

describe('Niflheim Health Router', () => {
  let app: express.Application;
  const mockConfig: RealmConfig = {
    port: 3000,
    flag: 'YGGDRASIL{NIFLHEIM:00000000-0000-0000-0000-000000000000}',
    realmName: 'niflheim',
    nodeEnv: 'test',
  };

  beforeEach(() => {
    app = express();
    app.use(createHealthRouter(mockConfig));
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
    });

    it('should return JSON response', async () => {
      const response = await request(app).get('/health');
      
      expect(response.type).toBe('application/json');
    });

    it('should include status field', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should include realm name', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body).toHaveProperty('realm', 'niflheim');
    });

    it('should include timestamp', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body).toHaveProperty('timestamp');
      const timestamp = new Date(response.body.timestamp).getTime();
      const now = Date.now();
      
      // Timestamp should be within last 5 seconds
      expect(timestamp).toBeLessThanOrEqual(now);
      expect(timestamp).toBeGreaterThan(now - 5000);
    });

    it('should return valid ISO timestamp format', async () => {
      const response = await request(app).get('/health');
      
      const timestamp = response.body.timestamp;
      expect(() => new Date(timestamp).toISOString()).not.toThrow();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
