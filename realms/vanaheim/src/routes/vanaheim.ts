/**
 * Vanaheim Routes
 * 
 * OWASP A04:2025 - Cryptographic Failures
 * Merchant realm with predictable token-based authentication
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { TokenService } from '../services/token-service';
import { AuthService } from '../services/auth-service';
import { TokenAnalysisService } from '../services/analysis-service';

export function createVanaheimRouter(
  config: RealmConfig,
  tokenService: TokenService,
  authService: AuthService
): Router {
  const router = Router();
  
  // Initialize analysis service
  const analysisService = new TokenAnalysisService();

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
   * GET /api/token-history
   * VULNERABLE: Exposes token history including seeds and timestamps
   * This allows attackers to analyze patterns and predict future tokens
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
          seed: t.seed, // VULNERABLE: Exposes seed values
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
   * POST /api/admin-login
   * Authenticate with a token to gain admin access
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
   * GET /api/vault
   * Access the vault (requires admin authentication)
   * Returns the realm flag
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

      // Admin access granted - return flag
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

  /**
   * GET /api/analyze
   * 
   * VULNERABLE: Analyze token generation pattern and expose PRNG internals
   * 
   * SPOILER: This endpoint reveals:
   * - All seeds used in token generation
   * - LCG algorithm parameters (a, c, m)
   * - Pattern detection and entropy measurements
   * 
   * EXPLOIT: Use this data to predict future tokens for admin access
   */
  router.get('/api/analyze', (req: Request, res: Response) => {
    try {
      const history = tokenService.getTokenHistory();
      
      if (history.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient data for analysis',
          hint: 'Generate at least 3 tokens first using /api/generate-token',
          currentCount: history.length,
        });
      }

      // VULNERABLE: Perform pattern analysis and expose everything
      const analysis = analysisService.analyzePattern(history);

      res.json({
        success: true,
        message: 'Token pattern analysis complete',
        warning: '⚠️ This analysis exposes critical cryptographic information',
        analysis: {
          tokenCount: history.length,
          seeds: analysis.seeds, // VULNERABLE: Full seed history
          deltas: analysis.deltas,
          lcgParams: analysis.lcgParams, // VULNERABLE: Algorithm parameters
          predictable: analysis.predictable,
          nextPrediction: analysis.nextPrediction,
          entropy: analysis.entropy,
          entropyPercent: `${(analysis.entropy * 100).toFixed(2)}%`,
          pattern: analysis.pattern,
          warnings: analysis.warnings,
        },
        hint: 'Use the LCG parameters to predict tokens for any userId',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Analysis failed');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * POST /api/predict
   * 
   * VULNERABLE: Predict next token value from a given seed
   * 
   * EXPLOIT: Use this with known seeds to predict admin tokens
   */
  router.post('/api/predict', (req: Request, res: Response) => {
    const { seed, steps } = req.body;

    if (!seed) {
      return res.status(400).json({
        success: false,
        error: 'seed is required',
        hint: 'Use a seed from /api/token-history or /api/analyze',
      });
    }

    try {
      const seedNum = typeof seed === 'string' ? parseInt(seed, 10) : seed;
      const stepsNum = steps ? parseInt(steps, 10) : 1;

      // VULNERABLE: Calculate next seed values
      const prediction = analysisService.predictNext(seedNum, stepsNum);

      // VULNERABLE: Generate actual token from predicted seed
      const predictedToken = analysisService.generateTokenFromSeed(prediction.nextSeed);

      res.json({
        success: true,
        message: 'Token prediction complete',
        prediction: {
          ...prediction,
          predictedToken,
          warning: '⚠️ This token can be used for authentication',
        },
        hint: 'Use the predicted token with /api/admin-login',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Prediction failed');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  /**
   * POST /api/calculate-seed
   * 
   * VULNERABLE: Calculate expected seed for any userId at any timestamp
   * 
   * EXPLOIT: Use this to predict seeds for admin at current time
   */
  router.post('/api/calculate-seed', (req: Request, res: Response) => {
    const { userId, timestamp } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
        hint: 'Try userId="admin"',
      });
    }

    try {
      const timestampNum = timestamp ? parseInt(timestamp, 10) : Date.now();
      
      // VULNERABLE: Calculate seed for given user and time
      const expectedSeed = analysisService.calculateExpectedSeed(
        userId,
        timestampNum,
        config.tokenSeedMultiplier
      );

      // VULNERABLE: Generate token from calculated seed
      const predictedToken = analysisService.generateTokenFromSeed(expectedSeed);

      res.json({
        success: true,
        message: 'Seed calculated successfully',
        result: {
          userId,
          timestamp: timestampNum,
          timestampDate: new Date(timestampNum).toISOString(),
          expectedSeed,
          predictedToken,
          warning: '⚠️ This reveals the exact token for the specified user and time',
        },
        hint: 'Use timestamp=Date.now() to predict current admin token',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Seed calculation failed');
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  return router;
}
