/**
 * Alfheim Routes - Cloud Storage
 * OWASP A02:2025 - Security Misconfiguration
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { StorageService, Credentials } from '../services/storage-service';

export function createAlfheimRouter(
  config: RealmConfig,
  storageService: StorageService
): Router {
  const router = Router();

  /**
   * 
   */
  router.get('/api/cloud/buckets', (_req: Request, res: Response) => {
    const buckets = storageService.listBuckets();
    
    res.json({
      success: true,
      buckets: buckets.map(b => ({
        name: b.name,
        public: b.public,
        objectCount: b.objects.length,
        owner: b.owner,
      })),
      region: 'alfheim-north-1',
    });
  });

  /**
   * 
   */
  router.get('/api/cloud/bucket/:name/objects', (req: Request, res: Response) => {
    const { name } = req.params;
    
    // Extract credentials from request body/query if provided
    let credentials: Credentials | undefined;
    if (req.query.accessKeyId) {
      credentials = {
        AccessKeyId: req.query.accessKeyId as string,
        SecretAccessKey: req.query.secretAccessKey as string,
        Token: req.query.token as string,
      };
    }
    
    const objects = storageService.listObjects(name, credentials);
    
    if (objects === null) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Bucket is private and requires valid credentials.',
        bucket: name,
      });
    }

    res.json({
      success: true,
      bucket: name,
      objects,
    });
  });

  /**
   * 
   */
  router.get('/api/cloud/object/:bucket/:key', (req: Request, res: Response) => {
    const { bucket, key } = req.params;
    
    // 
    let credentials: Credentials | undefined;
    if (req.query.accessKeyId) {
      credentials = {
        AccessKeyId: req.query.accessKeyId as string,
        SecretAccessKey: req.query.secretAccessKey as string,
        Token: req.query.token as string,
      };
    }
    
    const object = storageService.getObject(bucket, key, credentials);
    
    if (!object) {
      return res.status(403).json({
        success: false,
        error: 'Access denied or object not found',
      });
    }

    res.json({
      success: true,
      object: {
        bucket,
        key: object.key,
        content: object.content,
        contentType: object.contentType,
        acl: object.acl,
      },
    });
  });

  router.get('/api/stats', (_req: Request, res: Response) => {
    res.json({
      success: true,
      stats: {
        realm: 'Alfheim',
        vulnerability: 'A02:2025 - Security Misconfiguration',
        description: 'Cloud IAM misconfiguration + metadata exposure',
      },
    });
  });

  return router;
}
