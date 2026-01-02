import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

export function enhancedSecurityHeaders(nodeEnv: string) {
  const isProduction = nodeEnv === 'production';

  return (req: Request, res: Response, next: NextFunction) => {
    // ASVS V3.4.1: HSTS with 1 year max-age
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Generate CSP nonce for inline scripts
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.nonce = nonce;

    // ASVS V3.4.3: Robust Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts and inline styles
      "img-src 'self' data:",
      "font-src 'self' https://fonts.gstatic.com", // Allow Google Fonts
      "connect-src 'self'",
      "frame-ancestors 'none'", // ASVS V3.4.6
      "object-src 'none'",
      "base-uri 'none'",
    ];
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    // ASVS V3.4.4: Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // ASVS V3.4.5: Prevent referrer leakage
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // X-Frame-Options (legacy support alongside CSP frame-ancestors)
    res.setHeader('X-Frame-Options', 'DENY');

    next();
  };
}

// Legacy export for backward compatibility
export const securityHeaders = enhancedSecurityHeaders('development');
