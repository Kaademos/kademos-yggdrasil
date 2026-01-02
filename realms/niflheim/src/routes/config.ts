/**
 * Configuration File Route
 * 
 * Serves configuration files to the SCADA frontend
 * SPOILER: Config files contain hints about Helheim integration
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export function createConfigRouter(): Router {
  const router = Router();

  /**
   * GET /api/config/:filename
   * 
   * Serves configuration files
   * Allowed files: pressure.conf, system.conf
   * 
   * SPOILER: system.conf contains Helheim URL and credentials
   */
  router.get('/api/config/:filename', (req: Request, res: Response) => {
    const { filename } = req.params;

    // Basic whitelist validation (intentionally limited)
    const allowedFiles = ['pressure.conf', 'system.conf'];
    
    if (!allowedFiles.includes(filename)) {
      return res.status(404).json({
        error: 'File not found',
        message: 'Configuration file does not exist'
      });
    }

    const configPath = path.join(__dirname, '../../config', filename);

    // Check if file exists
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({
        error: 'File not found',
        message: 'Configuration file not available'
      });
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(content);
    } catch (error) {
      res.status(500).json({
        error: 'Internal error',
        message: 'Failed to read configuration file'
      });
    }
  });

  return router;
}
