/**
 * Yggdrasil Shared Error Handler
 * 
 * Provides consistent error handling across all realms while preserving
 * intentional vulnerability leaks for educational purposes.
 * 
 * M13: Immersion & Final Polish
 */

import { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuration for the error handler
 */
export interface ErrorHandlerConfig {
  realmName: string;
  realmTheme: string;
  templatesDir?: string;
  enableStackTrace?: boolean;
  logErrors?: boolean;
  intentionalLeakPatterns?: RegExp[];
}

/**
 * Intentional error that should leak information for vulnerability exploitation
 */
export interface IntentionalError extends Error {
  isIntentional?: boolean;
  leakDetails?: Record<string, unknown>;
  statusCode?: number;
}

/**
 * Check if an error should intentionally leak information
 */
function isIntentionalError(
  err: Error | IntentionalError,
  patterns: RegExp[]
): boolean {
  // Check if explicitly marked as intentional
  if ((err as IntentionalError).isIntentional) {
    return true;
  }

  // Check error message against patterns
  const message = err.message || '';
  return patterns.some(pattern => pattern.test(message));
}

/**
 * Handle intentional errors (preserve vulnerability leaks)
 */
function handleIntentionalError(
  err: IntentionalError,
  req: Request,
  res: Response,
  config: ErrorHandlerConfig
): void {
  const statusCode = err.statusCode || 500;
  
  // INTENTIONAL: Return error details for vulnerability exploitation
  // VULNERABLE: This is the challenge - error info leaks are preserved
  res.status(statusCode).json({
    error: err.message,
    ...err.leakDetails,
  });
}

/**
 * Get error page template
 */
function getErrorPage(
  statusCode: number,
  realmName: string,
  realmTheme: string,
  config: ErrorHandlerConfig
): string {
  const templatesDir = config.templatesDir || path.join(__dirname, '../templates');
  const errorFile = path.join(templatesDir, `error-${statusCode}.html`);
  
  // Try to load realm-specific error page
  if (fs.existsSync(errorFile)) {
    let template = fs.readFileSync(errorFile, 'utf-8');
    
    // Replace placeholders
    template = template.replace(/\{REALM_NAME\}/g, realmName);
    template = template.replace(/\{REALM_THEME\}/g, realmTheme);
    template = template.replace(/\{ERROR_CODE\}/g, String(statusCode));
    
    return template;
  }
  
  // Fallback to generic error page
  return getGenericErrorPage(statusCode, realmName);
}

/**
 * Generate a generic error page when template doesn't exist
 */
function getGenericErrorPage(statusCode: number, realmName: string): string {
  const errorTitles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  const title = errorTitles[statusCode] || 'Error';
  
  return `
<!DOCTYPE html>
<html lang="en" data-realm="${realmName.toLowerCase()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusCode} - ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eaeaea;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .error-container {
      max-width: 600px;
      text-align: center;
      background: rgba(26, 26, 46, 0.95);
      padding: 3rem;
      border-radius: 12px;
      border: 2px solid rgba(100, 100, 200, 0.3);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    .error-code {
      font-size: 6rem;
      font-weight: 800;
      color: #6464c8;
      line-height: 1;
      margin-bottom: 1rem;
    }
    .error-title {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #eaeaea;
    }
    .error-description {
      font-size: 1.1rem;
      color: #b0b0c0;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #6464c8;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .btn:hover {
      background: #5050b0;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(100, 100, 200, 0.4);
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-code">${statusCode}</div>
    <h1 class="error-title">${title}</h1>
    <p class="error-description">
      The page you requested could not be displayed. 
      Please return to the homepage or contact support if the issue persists.
    </p>
    <a href="/" class="btn">Return Home</a>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Log error details (for debugging, not shown to users)
 */
function logError(
  err: Error,
  req: Request,
  realmName: string
): void {
  console.error(`[${realmName}] Error:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create the error handling middleware
 */
export function createErrorHandler(config: ErrorHandlerConfig) {
  const {
    realmName,
    realmTheme,
    enableStackTrace = false,
    logErrors = true,
    intentionalLeakPatterns = [],
  } = config;

  return (err: Error | IntentionalError, req: Request, res: Response, next: NextFunction) => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(err);
    }

    // Log all errors (even intentional ones) for monitoring
    if (logErrors) {
      logError(err, req, realmName);
    }

    // Check if this is an intentional vulnerability leak
    if (isIntentionalError(err, intentionalLeakPatterns)) {
      return handleIntentionalError(err, req, res, config);
    }

    // Generic error: branded page, no internal details
    const statusCode = (err as IntentionalError).statusCode || 500;
    const errorPage = getErrorPage(statusCode, realmName, realmTheme, config);

    res.status(statusCode).send(errorPage);
  };
}

/**
 * Create a 404 handler for unmatched routes
 */
export function create404Handler(realmName: string, realmTheme: string) {
  return (req: Request, res: Response) => {
    const errorPage = getErrorPage(404, realmName, realmTheme, {
      realmName,
      realmTheme,
    });
    res.status(404).send(errorPage);
  };
}

/**
 * Utility: Create an intentional error that will leak information
 */
export function createIntentionalError(
  message: string,
  leakDetails?: Record<string, unknown>,
  statusCode = 500
): IntentionalError {
  const error = new Error(message) as IntentionalError;
  error.isIntentional = true;
  error.leakDetails = leakDetails;
  error.statusCode = statusCode;
  return error;
}
