/**
 * Niflheim Pressure Route Unit Tests
 * 
 * NOTE: We test non-vulnerable paths only.
 * The vulnerability (exception handling) is tested in integration tests.
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
      expect(response.body).toHaveProperty('currentPressure');
      expect(response.body).toHaveProperty('doorStatus');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid pressure value', async () => {
      const response = await request(app).get('/api/status');
      
      expect(typeof response.body.currentPressure).toBe('number');
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

  describe('POST /api/pressure - Valid Operations', () => {
    it('should accept valid pressure in normal range', async () => {
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('state');
    });

    it('should update pressure state correctly', async () => {
      const testPressure = 75;
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: testPressure });
      
      expect(response.body.state.currentPressure).toBe(testPressure);
    });

    it('should set door status to LOCKED for low pressure', async () => {
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: 30 });
      
      expect(response.body.state.doorStatus).toBe('LOCKED');
    });

    it('should set door status to UNLOCKED for high pressure', async () => {
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: 90 });
      
      expect(response.body.state.doorStatus).toBe('UNLOCKED');
    });

    it('should accept pressure at lower boundary', async () => {
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: 0 });
      
      expect(response.status).toBe(200);
      expect(response.body.state.currentPressure).toBe(0);
    });

    it('should accept pressure at upper boundary', async () => {
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: 100 });
      
      expect(response.status).toBe(200);
      expect(response.body.state.currentPressure).toBe(100);
    });

    it('should update timestamp on pressure change', async () => {
      const beforeTime = Date.now();
      
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: 50 });
      
      const afterTime = Date.now();
      const responseTime = new Date(response.body.state.timestamp).getTime();
      
      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });

    it('should accept string pressure values', async () => {
      const response = await request(app)
        .post('/api/pressure')
        .send({ pressure: '50' });
      
      expect(response.status).toBe(200);
      expect(response.body.state.currentPressure).toBe(50);
    });
  });

  // NOTE: We do NOT test the vulnerability here
  // The exception handling for invalid values is tested in integration tests
  // This is intentional - the vulnerability is the feature
});
