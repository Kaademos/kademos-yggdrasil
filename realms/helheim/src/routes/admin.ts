/**
 * Admin Backend Route (M9)
 * 
 * VULNERABILITY: A01:2025 - Broken Access Control (LFI via path traversal)
 * 
 * Admin panel for log viewing with intentional LFI vulnerability.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export function createAdminRouter(): Router {
  const router = Router();

  /**
   * GET /admin
   * 
   * Admin panel landing page
   * VULNERABLE: Weak basic auth (credential from Niflheim)
   */
  router.get('/admin', (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    
    // VULNERABLE: Weak credential check
    // SPOILER: Credential is admin:IceBound2025 (from Niflheim crash report)
    // Base64 encoding of "admin:IceBound2025" is "YWRtaW46SWNlQm91bmQyMDI1"
    if (auth !== 'Basic YWRtaW46SWNlQm91bmQyMDI1') {
      res.setHeader('WWW-Authenticate', 'Basic realm="Helheim Admin"');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Admin credentials required'
      });
    }

    // Serve admin panel HTML
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
  });

  /**
   * GET /admin/logs
   * 
   * Log viewer endpoint
   * VULNERABLE: Local File Inclusion via path traversal
   * EXPLOIT: Use file=../sensitive/niflheim_correlation.log to access sensitive logs
   */
  router.get('/admin/logs', (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    
    // Check auth
    if (auth !== 'Basic YWRtaW46SWNlQm91bmQyMDI1') {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Admin credentials required'
      });
    }

    const { file } = req.query;
    
    if (!file || typeof file !== 'string') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'file parameter is required'
      });
    }

    const logsDir = path.join(__dirname, '../../logs');
    const filePath = path.join(logsDir, file);
    
    // VULNERABLE: No path validation!
    // EXPLOIT: This allows directory traversal
    // Should check: path.resolve(filePath).startsWith(logsDir)
    // But intentionally omitted for the vulnerability
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'File not found',
        message: `Log file "${file}" does not exist`,
        hint: 'Available logs: app.log, error.log, memorial.log'
      });
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(content);
    } catch (error) {
      res.status(500).json({
        error: 'Internal error',
        message: 'Failed to read log file'
      });
    }
  });

  return router;
}
