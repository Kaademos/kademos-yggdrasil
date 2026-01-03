/**
 * Niflheim Pressure Route Unit Tests (M9 Updated)
 * 
 * NOTE: We test non-vulnerable paths only.
 * The vulnerability (exception handling) is tested in integration tests.
 * 
 * M9 Update: API changed from /api/pressure to /api/regulate with multi-parameter input
 */

import express from 'express';
import request from 'supertest';
import { createPressureRouter } from '../../src/routes/pressure';
import { RealmConfig } from '../../src/config';

describe('Niflheim Pressure Router', () => {
  let app: express.Application;
  const mockConfig: RealmConfig = {
    port: 3000,
    flag: 'YGGDRASIL{NIFLHEIM:00000000-0000-0000-0000-000000000000}',
    realmName: 'niflheim',
    nodeEnv: 'test',
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(createPressureRouter(mockConfig));
  });

  describe('GET /api/status', () => {
    it('should return current system state', async () => {
      const response = await request(app).get('/api/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pressure');
      expect(response.body).toHaveProperty('temperature');
      expect(response.body).toHaveProperty('flowRate');
      expect(response.body).toHaveProperty('doorStatus');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid pressure value', async () => {
      const response = await request(app).get('/api/status');
      
      expect(typeof response.body.pressure).toBe('number');
    });

    it('should return valid door status', async () => {
      const response = await request(app).get('/api/status');
      
      expect(['LOCKED', 'UNLOCKED']).toContain(response.body.doorStatus);
    });

    it('should return valid timestamp', async () => {
      const response = await request(app).get('/api/status');
      
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });
  });

  describe('GET /api/trends', () => {
    it('should return trend data array', async () => {
      const response = await request(app).get('/api/trends');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/regulate - Valid Operations', () => {
    it('should accept valid parameters in normal range', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 500, temperature: -200, flowRate: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('systemState');
    });

    it('should update pressure state correctly', async () => {
      const testPressure = 750;
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: testPressure, temperature: -200, flowRate: 50 });
      
      expect(response.body.systemState.pressure).toBe(testPressure);
    });

    it('should set door status to LOCKED for low pressure', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 300, temperature: -200, flowRate: 50 });
      
      expect(response.body.systemState.doorStatus).toBe('LOCKED');
    });

    it('should set door status to UNLOCKED for high pressure', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 900, temperature: -200, flowRate: 50 });
      
      expect(response.body.systemState.doorStatus).toBe('UNLOCKED');
    });

    it('should accept pressure at lower boundary', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 0, temperature: -200, flowRate: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body.systemState.pressure).toBe(0);
    });

    it('should accept pressure at upper boundary (1000)', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 1000, temperature: -200, flowRate: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body.systemState.pressure).toBe(1000);
    });

    it('should update timestamp on regulation', async () => {
      const beforeTime = Date.now();
      
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 500, temperature: -200, flowRate: 50 });
      
      const afterTime = Date.now();
      const responseTime = new Date(response.body.systemState.timestamp).getTime();
      
      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });

    it('should reject non-numeric pressure values', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 'invalid', temperature: -200, flowRate: 50 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('should clamp pressure to valid range', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 5000, temperature: -200, flowRate: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body.systemState.pressure).toBe(1000);
    });
  });

  describe('POST /api/regulate - Input Validation', () => {
    it('should require all parameters to be numeric', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 500, temperature: 'cold', flowRate: 50 });
      
      expect(response.status).toBe(400);
    });

    it('should clamp temperature to valid range', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 500, temperature: 100, flowRate: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body.systemState.temperature).toBe(0);
    });

    it('should clamp flowRate to valid range', async () => {
      const response = await request(app)
        .post('/api/regulate')
        .send({ pressure: 500, temperature: -200, flowRate: 200 });
      
      expect(response.status).toBe(200);
      expect(response.body.systemState.flowRate).toBe(100);
    });
  });

  // NOTE: Vulnerability tests (extreme values triggering crash reports) are in integration tests
});
