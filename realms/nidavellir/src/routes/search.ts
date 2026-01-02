/**
 * Search Routes - VULNERABLE TO UNION-BASED SQL INJECTION
 * 
 * OWASP A05:2025 - Injection
 * SPOILER: Search endpoint exposes SQL errors to enable UNION injection learning
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { SearchService } from '../services/search-service';

export function createSearchRouter(config: RealmConfig, searchService: SearchService): Router {
  const router = Router();

  /**
   * GET /api/search
   * 
   * VULNERABLE: Search artifacts with UNION-based SQL injection
   * Query parameter: query
   * 
   * EXPLOIT: Use UNION SELECT to extract from secrets table
   * Example: ?query=' UNION SELECT id,realm,access_code,security_level,NULL,NULL,NULL FROM secrets--
   */
  router.get('/api/search', async (req: Request, res: Response) => {
    const searchQuery = req.query.query as string;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "query" is required',
        hint: 'Try /api/search?query=sword'
      });
    }

    try {
      // VULNERABLE: Passes unsanitized input to SQL builder
      const artifacts = await searchService.searchArtifacts(searchQuery);
      
      return res.status(200).json({
        success: true,
        query: searchQuery,
        count: artifacts.length,
        artifacts: artifacts.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          rarity: a.rarity,
          forgeDate: a.forge_date,
          forgeMaster: a.forge_master,
          material: a.material
        }))
      });
    } catch (error: unknown) {
      // VULNERABLE: Expose SQL error details for UNION injection learning
      // This is intentional to help students learn the technique
      const err = error as { message?: string; code?: string };
      return res.status(500).json({
        success: false,
        error: 'Database error',
        details: err.message || 'Unknown error', // SQL syntax errors visible
        hint: 'Try using SQL UNION to combine queries',
        sqlState: err.code, // PostgreSQL error code
        query: searchQuery // Echo back the query for debugging
      });
    }
  });

  /**
   * GET /api/artifacts
   * 
   * Get all artifacts (safe endpoint)
   */
  router.get('/api/artifacts', async (_req: Request, res: Response) => {
    try {
      const artifacts = await searchService.getAllArtifacts();
      
      return res.status(200).json({
        success: true,
        count: artifacts.length,
        artifacts
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch artifacts'
      });
    }
  });

  /**
   * GET /api/artifacts/:id
   * 
   * Get artifact by ID (safe endpoint with parameterized query)
   * This demonstrates proper SQL query handling
   */
  router.get('/api/artifacts/:id', async (req: Request, res: Response) => {
    const artifactId = parseInt(req.params.id, 10);

    if (isNaN(artifactId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artifact ID'
      });
    }

    try {
      const artifact = await searchService.getArtifactById(artifactId);
      
      if (!artifact) {
        return res.status(404).json({
          success: false,
          error: 'Artifact not found'
        });
      }

      return res.status(200).json({
        success: true,
        artifact
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch artifact'
      });
    }
  });

  return router;
}
