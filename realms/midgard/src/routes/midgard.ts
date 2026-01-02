/**
 * Midgard Routes
 * 
 * OWASP A03:2025 - Supply Chain Failures
 * Marketplace with dependency confusion vulnerability
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { PackageResolverService } from '../services/package-resolver';

export function createMidgardRouter(
  config: RealmConfig,
  packageResolver: PackageResolverService
): Router {
  const router = Router();

  /**
   * GET /api/packages
   * List all available packages from both registries
   */
  router.get('/api/packages', (_req: Request, res: Response) => {
    try {
      const packages = packageResolver.listPackages();
      
      res.json({
        success: true,
        packages: {
          public: packages.public.map(p => ({
            name: p.name,
            version: p.version,
            registry: p.registry,
            description: p.description,
          })),
          private: packages.private.map(p => ({
            name: p.name,
            version: p.version,
            registry: p.registry,
            description: p.description,
          })),
        },
        hint: 'Notice the naming similarities between public and private packages...',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to list packages',
      });
    }
  });

  /**
   * GET /api/package/:name
   * Get details about a specific package
   */
  router.get('/api/package/:name', (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const pkg = packageResolver.resolvePackage(name);
      
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Package not found',
        });
      }

      res.json({
        success: true,
        package: {
          name: pkg.name,
          version: pkg.version,
          registry: pkg.registry,
          description: pkg.description,
          exports: Object.keys(pkg.exports),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get package details',
      });
    }
  });

  /**
   * POST /api/install
   * VULNERABLE: Install package using ambiguous resolution
   */
  router.post('/api/install', (req: Request, res: Response) => {
    const { packageName } = req.body;

    if (!packageName) {
      return res.status(400).json({
        success: false,
        error: 'packageName is required',
      });
    }

    try {
      const pkg = packageResolver.installPackage(packageName);
      
      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: 'Package not found in any registry',
        });
      }

      res.json({
        success: true,
        message: `Package ${packageName} installed successfully`,
        package: {
          name: pkg.name,
          version: pkg.version,
          registry: pkg.registry,
        },
        warning: pkg.registry === 'public' && packageName.startsWith('@midgard/') === false
          ? 'Package resolved from PUBLIC registry - verify this is intended!'
          : undefined,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Installation failed',
      });
    }
  });

  /**
   * POST /api/execute
   * Execute a function from an installed package
   * VULNERABLE: Executes code from confused packages
   */
  router.post('/api/execute', (req: Request, res: Response) => {
    const { packageName, functionName, args } = req.body;

    if (!packageName || !functionName) {
      return res.status(400).json({
        success: false,
        error: 'packageName and functionName are required',
      });
    }

    try {
      // VULNERABLE: No validation of which registry the package came from
      const result = packageResolver.executePackageFunction(
        packageName,
        functionName,
        ...(args || [])
      );

      // Special handling for malicious package backdoor
      if (functionName === 'getSecretConfig') {
        // Pass the flag to the malicious function
        const backdoorResult = packageResolver.executePackageFunction(
          packageName,
          functionName,
          config.flag
        );
        
        return res.json({
          success: true,
          result: backdoorResult,
          warning: '⚠️ Malicious code executed! This function should not exist in legitimate packages.',
        });
      }

      res.json({
        success: true,
        result: result,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/installed
   * List installed packages
   */
  router.get('/api/installed', (_req: Request, res: Response) => {
    try {
      const installed = packageResolver.getInstalledPackages();
      
      res.json({
        success: true,
        installed: installed,
        count: installed.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get installed packages',
      });
    }
  });

  /**
   * GET /api/stats
   * Get realm statistics
   */
  router.get('/api/stats', (_req: Request, res: Response) => {
    const packages = packageResolver.listPackages();
    
    res.json({
      success: true,
      stats: {
        realm: 'Midgard',
        publicPackages: packages.public.length,
        privatePackages: packages.private.length,
        installedPackages: packageResolver.getInstalledPackages().length,
        vulnerability: 'A03:2025 - Supply Chain Failures',
        description: 'Dependency confusion via ambiguous package resolution',
      },
    });
  });

  return router;
}
