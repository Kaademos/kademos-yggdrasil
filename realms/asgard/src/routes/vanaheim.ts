/**
 * Vanaheim Routes
 * 
 * 
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { TokenService } from '../services/token-service';
import { AuthService } from '../services/auth-service';

export function createVanaheimRouter(
  config: RealmConfig,
  tokenService: TokenService,
  authService: AuthService
): Router {
  const router = Router();

  /**
   * POST /api/generate-token
   * Generate a new authentication token for a user
   */
  router.post('/api/generate-token', (req: Request, res: Response) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    try {
      const token = tokenService.generateToken(userId);
      
      res.json({
        success: true,
        token: {
          value: token.value,
          userId: token.userId,
          timestamp: token.timestamp,
        },
        message: 'Token generated successfully',
        hint: 'Tokens are generated using a time-based seed...',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Token generation failed',
      });
    }
  });

  /**
   * 
   */
  router.get('/api/token-history', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    try {
      const history = tokenService.getTokenHistory(limit);
      
      res.json({
        success: true,
        count: history.length,
        tokens: history.map(t => ({
          value: t.value,
          userId: t.userId,
          timestamp: t.timestamp,
          seed: t.seed, 
        })),
        hint: 'Can you find the pattern in these tokens?',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve token history',
      });
    }
  });

  /**
   * 
   */
  router.post('/api/admin-login', (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'token is required',
      });
    }

    try {
      const user = authService.authenticateWithToken(token);
      
      if (user) {
        res.json({
          success: true,
          user: {
            userId: user.userId,
            role: user.role,
            authenticated: user.authenticated,
          },
          message: 'Authentication successful',
          sessionToken: token,
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          hint: 'Study the token history to predict valid tokens',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  });

  /**
   * 
   */
  router.get('/api/vault', (req: Request, res: Response) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        hint: 'Provide a valid session token in Authorization header',
      });
    }

    try {
      const user = authService.getUserByToken(sessionToken);
      
      if (!user || !authService.isAdmin(user)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          hint: 'You need a valid admin token to access the vault',
        });
      }

      // 
      res.json({
        success: true,
        message: 'Vault accessed successfully',
        vault: {
          realm: 'Vanaheim',
          description: 'Merchant Realm Treasury',
          flag: config.flag,
          wealth: 'Infinite gold and amber',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Vault access failed',
      });
    }
  });

  /**
   * GET /api/stats
   * Get realm statistics
   */
  router.get('/api/stats', (_req: Request, res: Response) => {
    res.json({
      success: true,
      stats: {
        realm: 'Vanaheim',
        tokensGenerated: tokenService.getHistoryCount(),
        vulnerability: 'A04:2025 - Cryptographic Failures',
        description: 'Predictable token generation using weak PRNG',
      },
    });
  });

  return router;
}
