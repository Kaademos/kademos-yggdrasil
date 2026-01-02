/**
 * Crash Report Route
 * 
 * Serves crash report diagnostics
 * SPOILER: Crash reports contain Helheim URL and access credentials
 */

import { Router, Request, Response } from 'express';
import { getCrashReport } from '../services/crash-report-generator';

export function createCrashReportRouter(): Router {
  const router = Router();

  /**
   * GET /api/crash-report/:id
   * 
   * Retrieves crash report by ID
   * 
   * VULNERABLE: Crash reports contain sensitive system information
   * SPOILER: diagnosticNotes contain Helheim admin URL and credentials
   * EXPLOIT: Download crash report to discover realm chaining clues
   */
  router.get('/api/crash-report/:id', (req: Request, res: Response) => {
    const { id } = req.params;

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid crash report ID',
        message: 'Crash report ID must be a valid UUID'
      });
    }

    // Retrieve crash report
    const report = getCrashReport(id);

    if (!report) {
      return res.status(404).json({
        error: 'Crash report not found',
        message: `No crash report found with ID: ${id}`
      });
    }

    // Return crash report as JSON
    res.status(200).json(report);
  });

  return router;
}
