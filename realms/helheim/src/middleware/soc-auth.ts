/**
 * SOC Console Authentication
 *
 * Gate for the Níðhöggr console. The credential is not discovered here — it is
 * leaked by Niflheim's crash report, which names this service as its
 * LOG_CORRELATION_SERVICE and prints the diagnostic login in cleartext.
 *
 * NOTE: authentication succeeding or failing here is recorded nowhere and alerts
 * no one. That is the realm's subject matter, not an oversight.
 */

import { NextFunction, Request, Response } from 'express';
import { RealmConfig } from '../config';

export function createSocAuth(config: RealmConfig) {
  const expected = 'Basic ' + Buffer.from(config.adminCredential, 'utf-8').toString('base64');

  return function socAuth(req: Request, res: Response, next: NextFunction): void {
    if (req.headers.authorization === expected) {
      next();
      return;
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Nidhoggr SOC"');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Diagnostic credentials required for the log correlation service.',
      hint: 'Upstream realms embed this credential in their crash diagnostics.',
    });
  };
}
