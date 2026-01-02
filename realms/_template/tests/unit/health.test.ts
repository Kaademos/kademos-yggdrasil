/**
 * Health Route Unit Tests
 * 
 * Tests the health check endpoint.
 */

import express from 'express';
import request from 'supertest';
import { createHealthRouter } from '../../src/routes/health';
import { RealmConfig } from '../../src/config';

describe('Health Router', () => {
  let app: express.Application;
  const mockConfig: RealmConfig = {
    port: 3000,
    flag: 'YGGDRASIL{TEST:00000000-0000-0000-0000-000000000000}',
    realmName: 'test-realm',
    nodeEnv: 'test',
  };

  beforeEach(() => {
    app = express();
    app.use(createHealthRouter(mockConfig));
  });

  it('should return 200 OK for health check', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('should include realm name in response', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body).toHaveProperty('realm', 'test-realm');
  });

  it('should include timestamp in response', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body).toHaveProperty('timestamp');
    expect(new Date(response.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
