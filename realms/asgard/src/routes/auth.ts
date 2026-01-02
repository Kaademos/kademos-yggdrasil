/**
 * Asgard Authentication Routes
 * 
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';

export function createAuthRouter(db: DatabaseService): Router {
  const router = Router();

  /**
   * Password Reset Endpoint
   * 
   * 
   */
  router.post('/reset-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Validate input
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Email address is required'
        });
      }

      
      const query = `
        SELECT id, username, email FROM employees 
        WHERE email = '${email}' AND role = 'admin'
      `;

      console.log('[VULNERABLE SQLi Query]:', query);

      
      const result = await db.query(query);

      
      if (result.rows.length > 0) {
        
        res.json({
          success: true,
          message: 'Password reset link sent to admin email address',
          debug: process.env.NODE_ENV === 'development' ? 'Admin user found' : undefined
        });
      } else {
        
        res.json({
          success: false,
          message: 'Admin email not found or access denied'
        });
      }

    } catch (error: any) {
      
      console.error('[Password Reset Error]:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'System error, please try again later'
      });
    }
  });

  /**
   * 
   */
  router.post('/verify-email', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email required'
        });
      }

      const startTime = Date.now();

      
      const query = `
        SELECT id, email FROM employees 
        WHERE email = '${email}'
      `;

      await db.query(query);

      const endTime = Date.now();
      const duration = endTime - startTime;

      res.json({
        success: true,
        message: 'Email verification complete',
        timing: process.env.NODE_ENV === 'development' ? `${duration}ms` : undefined
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Verification failed'
      });
    }
  });

  /**
   * Login Endpoint
   * 
   * Route: POST /api/auth/login
   */
  router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    
    
    res.json({
      success: false,
      message: 'Authentication not implemented in this demo'
    });
  });

  return router;
}
