/**
 * Build Routes - CI/CD API
 * 
 * OWASP A03:2025 - Software Supply Chain Failures
 * Provides REST API for triggering builds and accessing artifacts
 */

import { Router, Request, Response } from 'express';
import { BuildService } from '../services/build-service';

export function createBuildRouter(buildService: BuildService): Router {
  const router = Router();

  /**
   * POST /api/build/create
   * Create a new build with dependencies
   */
  router.post('/api/build/create', async (req: Request, res: Response) => {
    const { projectName, dependencies } = req.body;

    if (!projectName || typeof projectName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'projectName (string) is required',
      });
    }

    if (!Array.isArray(dependencies) || dependencies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'dependencies (array) is required and must not be empty',
      });
    }

    // Validate dependencies are strings
    if (!dependencies.every(dep => typeof dep === 'string')) {
      return res.status(400).json({
        success: false,
        error: 'All dependencies must be strings',
      });
    }

    try {
      const build = await buildService.createBuild(projectName, dependencies);
      
      res.json({
        success: true,
        build: {
          buildId: build.buildId,
          projectName: build.projectName,
          status: build.status,
          startTime: build.startTime,
          endTime: build.endTime,
          dependencies: build.dependencies,
          logCount: build.logs.length,
          artifactCount: Object.keys(build.artifacts).length,
        },
        message: `Build ${build.buildId} created successfully`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: `Build failed: ${errorMessage}`,
      });
    }
  });

  /**
   * GET /api/build/:buildId
   * Get build details
   */
  router.get('/api/build/:buildId', (req: Request, res: Response) => {
    const { buildId } = req.params;
    const build = buildService.getBuild(buildId);

    if (!build) {
      return res.status(404).json({
        success: false,
        error: 'Build not found',
      });
    }

    res.json({
      success: true,
      build: {
        buildId: build.buildId,
        projectName: build.projectName,
        status: build.status,
        startTime: build.startTime,
        endTime: build.endTime,
        duration: build.endTime ? build.endTime - build.startTime : null,
        dependencies: build.dependencies,
        logCount: build.logs.length,
        artifactCount: Object.keys(build.artifacts).length,
      },
    });
  });

  /**
   * GET /api/build/:buildId/logs
   * Get build logs
   */
  router.get('/api/build/:buildId/logs', (req: Request, res: Response) => {
    const { buildId } = req.params;
    const logs = buildService.getBuildLogs(buildId);

    if (logs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Build not found or no logs available',
      });
    }

    res.json({
      success: true,
      buildId,
      logs,
      count: logs.length,
    });
  });

  /**
   * GET /api/build/:buildId/artifacts
   * List build artifacts
   */
  router.get('/api/build/:buildId/artifacts', (req: Request, res: Response) => {
    const { buildId } = req.params;
    const artifacts = buildService.getBuildArtifacts(buildId);

    if (Object.keys(artifacts).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No artifacts found for this build',
      });
    }

    res.json({
      success: true,
      buildId,
      artifacts: Object.keys(artifacts),
      count: Object.keys(artifacts).length,
    });
  });

  /**
   * GET /api/build/:buildId/artifacts/:name
   * Download specific artifact
   * SPOILER: Contains FLAG in build-metadata.json
   */
  router.get('/api/build/:buildId/artifacts/:name', (req: Request, res: Response) => {
    const { buildId, name } = req.params;
    const artifact = buildService.getBuildArtifact(buildId, name);

    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
    }

    // Return as downloadable file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(artifact);
  });

  /**
   * GET /api/builds
   * List all builds
   */
  router.get('/api/builds', (_req: Request, res: Response) => {
    const builds = buildService.listBuilds();

    res.json({
      success: true,
      builds: builds.map(build => ({
        buildId: build.buildId,
        projectName: build.projectName,
        status: build.status,
        startTime: build.startTime,
        endTime: build.endTime,
        duration: build.endTime ? build.endTime - build.startTime : null,
        dependencies: build.dependencies,
        artifactCount: Object.keys(build.artifacts).length,
      })),
      count: builds.length,
    });
  });

  /**
   * DELETE /api/build/:buildId
   * Delete a build (cleanup)
   */
  router.delete('/api/build/:buildId', (req: Request, res: Response) => {
    const { buildId } = req.params;
    const deleted = buildService.deleteBuild(buildId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Build not found',
      });
    }

    res.json({
      success: true,
      message: `Build ${buildId} deleted`,
    });
  });

  return router;
}
