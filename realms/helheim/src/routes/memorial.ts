/**
 * Memorial Forum Routes
 * 
 * VULNERABILITY: A09:2025 - Logging & Alerting Failures
 * 
 * This endpoint intentionally logs sensitive information (including flags)
 * to publicly accessible log files without any alerting or monitoring.
 * Stack traces and system details are written to /temp_logs/ which is
 * served as a static directory.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { RealmConfig } from '../config';

interface Memorial {
  id: number;
  name: string;
  message: string;
  timestamp: string;
}

// In-memory storage (resets on restart)
const memorials: Memorial[] = [
  {
    id: 1,
    name: 'Hela',
    message: 'In memory of those who fell in battle.',
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Guardian',
    message: 'The gates of Helheim stand eternal.',
    timestamp: new Date().toISOString(),
  },
];

let nextId = 3;

/**
 * VULNERABLE: Insecure logging function
 * 
 * This function logs errors to a publicly accessible directory
 * without any sanitization, alerting, or monitoring.
 */
function logErrorToFile(error: Error, context: Record<string, unknown>, config: RealmConfig): void {
  const logDir = path.join(__dirname, '../../public/temp_logs');
  const logFile = path.join(logDir, 'error.log');

  // VULNERABILITY: No monitoring or alerting on errors
  // VULNERABILITY: Logs contain sensitive information (flag)
  // VULNERABILITY: Logs are publicly accessible via HTTP

  const logEntry = `
================================================================================
[${new Date().toISOString()}] ERROR LOGGED
================================================================================

Error Message: ${error.message}

Stack Trace:
${error.stack}

Request Context:
${JSON.stringify(context, null, 2)}

System Information:
- Node Version: ${process.version}
- Platform: ${process.platform}
- Memory Usage: ${JSON.stringify(process.memoryUsage(), null, 2)}

SENSITIVE DATA (Should NOT be in logs):
- Realm: ${config.realmName.toUpperCase()}
- Access Flag: ${config.flag}
- Environment: ${config.nodeEnv}

================================================================================

`;

  try {
    // Ensure directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // VULNERABILITY: Append to publicly accessible log file
    fs.appendFileSync(logFile, logEntry, 'utf-8');
    
    // VULNERABILITY: No alerting system configured
    // In a real system, this should trigger alerts/notifications
    
  } catch (writeError) {
    // Even the error handler is vulnerable!
    console.error('Failed to write to log file:', writeError);
  }
}

export function createMemorialRouter(config: RealmConfig): Router {
  const router = Router();

  /**
   * GET /api/memorials
   * Returns list of all memorials
   */
  router.get('/api/memorials', (_req: Request, res: Response) => {
    res.status(200).json({
      memorials: memorials.slice(-10), // Last 10 memorials
      total: memorials.length,
    });
  });

  /**
   * POST /api/memorial
   * 
   * VULNERABLE ENDPOINT
   * 
   * This endpoint has poor validation that triggers exceptions,
   * which are then logged (with the flag) to a publicly accessible
   * log file.
   */
  router.post('/api/memorial', (req: Request, res: Response) => {
    try {
      const { name, message } = req.body;

      // INTENTIONAL VULNERABILITY: Weak validation that throws exceptions
      if (!name || !message) {
        const error = new Error(
          'Memorial submission validation failed. Both name and message are required. ' +
          'This error has been logged to the system.'
        );
        
        // VULNERABILITY: Log the error with sensitive information
        logErrorToFile(error, {
          body: req.body,
          headers: req.headers,
          ip: req.ip,
          url: req.url,
        }, config);

        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
        });
      }

      // INTENTIONAL VULNERABILITY: Type checking that throws
      if (typeof name !== 'string' || typeof message !== 'string') {
        const error = new Error(
          'Memorial data type validation failed. Expected string types. ' +
          'System integrity check logged.'
        );
        
        logErrorToFile(error, {
          body: req.body,
          nameType: typeof name,
          messageType: typeof message,
        }, config);

        return res.status(400).json({
          error: 'Type validation failed',
          message: error.message,
        });
      }

      // INTENTIONAL VULNERABILITY: Length validation that logs errors
      if (name.length > 100 || message.length > 500) {
        const error = new Error(
          'Memorial content exceeds maximum length. ' +
          'Security boundary violation logged for review.'
        );
        
        logErrorToFile(error, {
          body: req.body,
          nameLength: name.length,
          messageLength: message.length,
        }, config);

        return res.status(400).json({
          error: 'Content too long',
          message: 'Name must be ≤100 chars, message ≤500 chars',
        });
      }

      // Normal operation - create memorial
      const memorial: Memorial = {
        id: nextId++,
        name: name.trim(),
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };

      memorials.push(memorial);

      res.status(201).json({
        message: 'Memorial created successfully',
        memorial,
      });

    } catch (error) {
      // VULNERABILITY: Catch-all that logs everything
      logErrorToFile(error as Error, {
        body: req.body,
        error: error instanceof Error ? error.message : String(error),
      }, config);

      res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred. Details have been logged.',
      });
    }
  });

  /**
   * GET /api/system-status
   * Returns system status (always green - no real monitoring)
   */
  router.get('/api/system-status', (_req: Request, res: Response) => {
    // VULNERABILITY: Fake monitoring - always returns "operational"
    // No real alerting or monitoring is in place
    res.status(200).json({
      status: 'operational',
      monitoring: 'enabled', // Lie - no monitoring exists
      alerts: 0,
      lastCheck: new Date().toISOString(),
      message: 'All systems nominal',
    });
  });

  return router;
}
