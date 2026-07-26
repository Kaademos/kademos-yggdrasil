/**
 * Memorial Forum Routes
 *
 * The public face of Helheim, and the source of most of the benign traffic the
 * SOC console sees. Forum activity is forwarded into the correlation service so
 * the archive reflects live use.
 *
 * The error log this endpoint writes used to embed the realm flag and full
 * request headers in every stack trace. It no longer does: secrets are redacted
 * before write. That change is deliberate and is part of the lesson — the logging
 * here is now *correct*, and the realm is still undetectable, because nothing
 * downstream of the log ever raises an alert.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { RealmConfig } from '../config';
import { SocState } from '../services/soc-state';

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

/** Patterns scrubbed from any value before it reaches disk. */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/YGGDRASIL\{[^}]*\}/gi, '[REDACTED:FLAG]'],
  [/\b(authorization|cookie|x-api-key)\b\s*[:=]\s*\S+/gi, '$1: [REDACTED]'],
  [/\b[A-Za-z0-9._%+-]+:[^\s@]{6,}@/g, '[REDACTED:CREDENTIAL]@'],
];

export function redactSecrets(input: string): string {
  return SECRET_PATTERNS.reduce((acc, [pattern, replacement]) => {
    return acc.replace(pattern, replacement);
  }, input);
}

/**
 * Write a sanitised error record to the archive.
 *
 * Complete, accurate, redacted — and read by nobody. No threshold is evaluated,
 * no notification is emitted, no on-call is paged.
 */
function logErrorToFile(error: Error, context: Record<string, unknown>, config: RealmConfig): void {
  const logDir = path.join(__dirname, '../../logs');
  const logFile = path.join(logDir, 'memorial.log');

  const entry = redactSecrets(
    [
      `${new Date().toISOString()} helheim      LOW      memorial.validation_error    ` +
        `outcome=failure actor=anonymous :: ${error.message}`,
      `    context: ${JSON.stringify(context)}`,
      `    realm=${config.realmName} env=${config.nodeEnv}`,
      '',
    ].join('\n')
  );

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, entry, 'utf-8');

    // NOTE: nothing follows this write. No rule evaluation, no notification.
    // The record exists; the incident response does not.
  } catch (writeError) {
    console.error('Failed to write to log file:', writeError);
  }
}

export function createMemorialRouter(config: RealmConfig, state: SocState): Router {
  const router = Router();

  const forward = (
    req: Request,
    action: string,
    outcome: 'success' | 'failure',
    detail: string
  ): void => {
    state.ingest({
      source: 'helheim',
      actor: 'anonymous',
      action,
      outcome,
      severity: outcome === 'failure' ? 'LOW' : 'INFO',
      sourceIp: req.ip || 'unknown',
      detail: redactSecrets(detail),
    });
  };

  /**
   * GET /api/memorials
   */
  router.get('/api/memorials', (req: Request, res: Response) => {
    forward(req, 'memorial.view', 'success', 'Memorial list read');
    res.status(200).json({
      memorials: memorials.slice(-10),
      total: memorials.length,
    });
  });

  /**
   * POST /api/memorial
   *
   * Validation failures are logged, forwarded, and never alerted on.
   */
  router.post('/api/memorial', (req: Request, res: Response) => {
    try {
      const { name, message } = req.body ?? {};

      const reject = (
        status: number,
        errorLabel: string,
        detail: string,
        context: Record<string, unknown>
      ) => {
        const error = new Error(detail);
        logErrorToFile(error, context, config);
        forward(req, 'memorial.validation_error', 'failure', detail);
        return res.status(status).json({ error: errorLabel, message: detail });
      };

      if (!name || !message) {
        return reject(
          400,
          'Validation failed',
          'Memorial submission validation failed. Both name and message are required.',
          { fields: { name: Boolean(name), message: Boolean(message) } }
        );
      }

      if (typeof name !== 'string' || typeof message !== 'string') {
        return reject(400, 'Type validation failed', 'Memorial data type validation failed. Expected string types.', {
          nameType: typeof name,
          messageType: typeof message,
        });
      }

      if (name.length > 100 || message.length > 500) {
        return reject(400, 'Content too long', 'Memorial content exceeds maximum length.', {
          nameLength: name.length,
          messageLength: message.length,
        });
      }

      const memorial: Memorial = {
        id: nextId++,
        name: name.trim(),
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };

      memorials.push(memorial);
      forward(req, 'memorial.create', 'success', `Memorial ${memorial.id} committed`);

      return res.status(201).json({
        message: 'Memorial created successfully',
        memorial,
      });
    } catch (error) {
      logErrorToFile(error as Error, { body: req.body }, config);
      forward(req, 'memorial.error', 'failure', 'Unhandled error in memorial submission');

      return res.status(500).json({
        error: 'Internal server error',
        message: 'An error occurred. Details have been logged.',
      });
    }
  });

  /**
   * GET /api/system-status
   *
   * VULNERABLE (CWE-223): claims monitoring is enabled and reports a hard-coded
   * zero alert count. Both are true in the narrowest sense and useless in every
   * other — the alert count is zero because nothing can ever raise one.
   */
  router.get('/api/system-status', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'operational',
      monitoring: 'enabled',
      alerts: 0,
      lastCheck: new Date().toISOString(),
      message: 'All systems nominal',
    });
  });

  return router;
}
