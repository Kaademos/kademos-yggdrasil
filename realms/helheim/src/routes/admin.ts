/**
 * Níðhöggr SOC — Log Archive Viewer
 *
 * VULNERABILITY: A09:2025 - Logging & Alerting Failures (CWE-778)
 *
 * This viewer is deliberately *not* a path-traversal challenge. Filenames resolve
 * against a fixed allow-list, so `../` is not expressible — access control here is
 * sound, and broken access control belongs to Asgard (A01), not to this realm.
 *
 * What is wrong is downstream of that: an operator authenticating with a
 * credential harvested from another realm's crash dump, then reading the full
 * cross-realm correlation archive, generates no alert and leaves no audit record.
 * The read is permitted, recorded nowhere anyone will look, and escalated to no one.
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import { ARCHIVE_FILES, readArchiveFile } from '../services/log-archive';

export function createAdminRouter(): Router {
  const router = Router();

  /**
   * GET /admin
   * SOC console shell.
   */
  router.get('/admin', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../public/soc.html'));
  });

  /**
   * GET /admin/logs
   *
   * Lists the archive when called without a filename, serves a file when called
   * with one. `niflheim_correlation.log` is the artefact Niflheim's crash report
   * directs the player to.
   */
  router.get('/admin/logs', (req: Request, res: Response) => {
    const { file } = req.query;

    if (file === undefined) {
      return res.status(200).json({
        directory: '/var/log/nidhoggr',
        files: ARCHIVE_FILES,
        usage: 'GET /admin/logs?file=<name>',
        note:
          'Reads from this archive are not alerted on. Cross-realm reconstruction ' +
          'requires the correlation engine, not these flat files.',
      });
    }

    if (typeof file !== 'string') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'file parameter must be a string',
      });
    }

    const content = readArchiveFile(file);

    if (content === null) {
      return res.status(404).json({
        error: 'File not found',
        message: `Log file "${file}" is not present in the archive`,
        available: ARCHIVE_FILES,
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(content);
  });

  return router;
}
