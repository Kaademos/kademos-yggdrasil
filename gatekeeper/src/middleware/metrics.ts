import { Request, Response, NextFunction } from 'express';
import { metrics } from '../utils/metrics';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route?.path || req.path || 'unknown';

    metrics.httpRequestsTotal.inc({
      method: req.method,
      path,
      status: res.statusCode.toString(),
      service: 'gatekeeper',
    });

    metrics.httpRequestDuration.observe(
      {
        method: req.method,
        path,
        service: 'gatekeeper',
      },
      duration
    );
  });

  next();
};
