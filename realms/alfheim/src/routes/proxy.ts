/**
 * Proxy Routes
 * 
 * 
 * VULNERABLE: Weak IP blocklist allows IMDS access
 */

import { Router, Request, Response } from 'express';
import { ProxyService } from '../services/proxy-service';

export function createProxyRouter(proxyService: ProxyService): Router {
  const router = Router();

  /**
   * POST /api/proxy/fetch
   * Fetch URL through proxy
   * 
   * Body: { url, method?, headers?, timeout? }
   */
  router.post('/api/proxy/fetch', async (req: Request, res: Response) => {
    const { url, method, headers, timeout } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    try {
      const result = await proxyService.fetchUrl({
        url,
        method: method || 'GET',
        headers: headers || {},
        timeout: timeout || 5000,
      });

      res.json(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * POST /api/proxy/test
   * 
   */
  router.post('/api/proxy/test', (req: Request, res: Response) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    const blocked = proxyService.testUrl(url);

    res.json({
      success: true,
      url,
      blocked,
      message: blocked ? 'URL would be blocked by filter' : 'URL passes filter check',
    });
  });

  /**
   * GET /api/proxy/hints
   *
   */
  router.get('/api/proxy/hints', (_req: Request, res: Response) => {
    const hints = proxyService.getBypassHints();

    res.json({
      success: true,
      vulnerability: 'SSRF with weak IP blocklist',
      hints,
      note: 'These techniques bypass the blocklist to access internal metadata service',
    });
  });

  /**
   * GET /api/proxy/blocklist
   * Get current blocklist (debugging)
   */
  router.get('/api/proxy/blocklist', (_req: Request, res: Response) => {
    const blocklist = proxyService.getBlocklist();

    res.json({
      success: true,
      blocklist,
      note: 'Simple string matching - easily bypassable',
    });
  });

  return router;
}
