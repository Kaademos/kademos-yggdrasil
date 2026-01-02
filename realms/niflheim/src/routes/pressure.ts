/**
 * Pressure Regulator Route (M9 Refactored)
 * 
 * VULNERABILITY: A10:2025 - Exceptional Conditions
 * 
 * M9 Update: Now uses realistic crash diagnostics instead of direct flag exposure.
 * Crash reports contain Helheim integration clues for realm chaining.
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { generateCrashReport } from '../services/crash-report-generator';

interface SystemState {
  pressure: number;
  temperature: number;
  flowRate: number;
  doorStatus: 'LOCKED' | 'UNLOCKED';
  timestamp: string;
}

let systemState: SystemState = {
  pressure: 500,
  temperature: -200,
  flowRate: 50,
  doorStatus: 'LOCKED',
  timestamp: new Date().toISOString(),
};

// Store trend data (last 10 readings)
const trendData: Array<{timestamp: string; pressure: number}> = [];

export function createPressureRouter(_config: RealmConfig): Router {
  const router = Router();

  /**
   * GET /api/status
   * Returns current system state (multi-parameter)
   */
  router.get('/api/status', (_req: Request, res: Response) => {
    res.status(200).json(systemState);
  });

  /**
   * GET /api/trends
   * Returns last 10 pressure readings for trend chart
   */
  router.get('/api/trends', (_req: Request, res: Response) => {
    res.status(200).json(trendData.slice(-10));
  });

  /**
   * POST /api/regulate
   * 
   * VULNERABLE ENDPOINT (M9 Refactored)
   * 
   * Now accepts multi-parameter input and generates crash reports
   * instead of directly exposing the flag. Crash reports contain
   * clues leading to Helheim admin panel (realm chaining).
   * 
   * Expected input: { pressure, temperature, flowRate }
   * EXPLOIT: Send extreme values to trigger crash report generation
   */
  router.post('/api/regulate', (req: Request, res: Response) => {
    const { pressure, temperature, flowRate } = req.body;

    // Validate input types
    if (typeof pressure !== 'number' || 
        typeof temperature !== 'number' || 
        typeof flowRate !== 'number') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'All parameters must be numeric values'
      });
    }

    // VULNERABLE: Insufficient range validation
    // EXPLOIT: Values outside these ranges trigger crash report
    // SPOILER: Crash report contains Helheim URL and credentials
    if (pressure > 10000 || temperature < -500 || flowRate > 9999) {
      // Generate crash report with diagnostic information
      const crashId = generateCrashReport({
        pressure,
        temperature,
        flowRate,
        timestamp: new Date(),
        helheimServiceUrl: 'http://helheim:3000/admin'
      });

      // Return 500 error with crash report info
      return res.status(500).json({
        error: 'CRITICAL_SYSTEM_FAILURE',
        message: 'Cryo-system integrity breach detected',
        diagnosticsAvailable: true,
        crashReportId: crashId,
        downloadUrl: `/api/crash-report/${crashId}`,
        errorCode: pressure > 10000 ? 'PRESSURE_OVERFLOW' : 
                   temperature < -500 ? 'TEMPERATURE_UNDERFLOW' : 
                   'FLOW_RATE_EXCEEDED',
        timestamp: new Date().toISOString()
      });
    }

    // Normal operation for valid parameter values
    systemState = {
      pressure: Math.max(0, Math.min(1000, pressure)),
      temperature: Math.max(-273, Math.min(0, temperature)),
      flowRate: Math.max(0, Math.min(100, flowRate)),
      doorStatus: pressure > 800 ? 'UNLOCKED' : 'LOCKED',
      timestamp: new Date().toISOString(),
    };

    // Add to trend data
    trendData.push({
      timestamp: systemState.timestamp,
      pressure: systemState.pressure
    });
    
    // Keep only last 20 readings
    if (trendData.length > 20) {
      trendData.shift();
    }

    res.status(200).json({
      message: 'System regulated successfully',
      systemState
    });
  });

  // Legacy endpoint removed - tests should use /api/regulate
  // router.post('/api/pressure', ...) is deprecated in M9

  return router;
}
