/**
 * IMDS Routes - Instance Metadata Service v2
 * 
 * OWASP A02:2025 - Security Misconfiguration
 * 
 */

import { Router, Request, Response } from 'express';
import { IMDSService } from '../services/imds-service';

export function createIMDSRouter(imdsService: IMDSService): Router {
  const router = Router();

  /**
   * PUT /api/imds/token
   * Generate IMDSv2 session token
   * 
   * 
   */
  router.put('/api/imds/token', (req: Request, res: Response) => {
    const token = imdsService.generateToken(req);

    if (!token) {
      return res.status(400).send('Invalid token request. Requires PUT method and X-aws-ec2-metadata-token-ttl-seconds header.');
    }

    
    res.setHeader('Content-Type', 'text/plain');
    res.send(token);
  });

  /**
   * GET /api/imds/metadata/*
   * 
   */
  router.get('/api/imds/metadata', (req: Request, res: Response) => {
    const token = req.headers['x-aws-ec2-metadata-token'] as string;

    if (!token) {
      return res.status(401).send('Unauthorized. Token required for IMDSv2.');
    }

    const paths = imdsService.getAvailablePaths(token);

    if (!paths) {
      return res.status(401).send('Invalid or expired token.');
    }

    // Return available metadata paths
    res.json({
      service: 'IMDSv2',
      version: 'latest',
      paths,
    });
  });

  /**
   * GET /api/imds/metadata/instance
   * Get instance metadata
   */
  router.get('/api/imds/metadata/instance', (req: Request, res: Response) => {
    const token = req.headers['x-aws-ec2-metadata-token'] as string;

    if (!token) {
      return res.status(401).send('Unauthorized. Token required.');
    }

    const metadata = imdsService.getInstanceMetadata(token);

    if (!metadata) {
      return res.status(401).send('Invalid or expired token.');
    }

    res.json(metadata);
  });

  /**
   * GET /api/imds/metadata/iam/role
   * Get IAM role name
   */
  router.get('/api/imds/metadata/iam/role', (req: Request, res: Response) => {
    const token = req.headers['x-aws-ec2-metadata-token'] as string;

    if (!token) {
      return res.status(401).send('Unauthorized. Token required.');
    }

    const role = imdsService.getIAMRole(token);

    if (!role) {
      return res.status(401).send('Invalid or expired token.');
    }

    // Return role name as plain text (AWS behavior)
    res.setHeader('Content-Type', 'text/plain');
    res.send(role);
  });

  /**
   * GET /api/imds/metadata/iam/credentials
   * 
   */
  router.get('/api/imds/metadata/iam/credentials', (req: Request, res: Response) => {
    const token = req.headers['x-aws-ec2-metadata-token'] as string;
    const { role } = req.query;

    if (!token) {
      return res.status(401).send('Unauthorized. Token required.');
    }

    if (!role || typeof role !== 'string') {
      return res.status(400).send('Missing role parameter.');
    }

    const credentials = imdsService.getIAMCredentials(token, role);

    if (!credentials) {
      return res.status(401).send('Invalid token or role not found.');
    }

    // Return credentials in AWS format
    res.json(credentials);
  });

  /**
   * GET /api/imds/stats
   * Get IMDS service stats (debugging)
   */
  router.get('/api/imds/stats', (_req: Request, res: Response) => {
    res.json({
      service: 'IMDSv2',
      activeTokens: imdsService.getTokenCount(),
      vulnerability: 'A02:2025 - Security Misconfiguration',
      note: 'Accessible via SSRF proxy bypass',
    });
  });

  return router;
}
