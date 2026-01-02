/**
 * BuildService Unit Tests
 * 
 * Tests CI/CD build simulation and artifact generation
 */

import { BuildService } from '../../src/services/build-service';

describe('BuildService', () => {
  let buildService: BuildService;
  const verdaccioUrl = 'http://test-registry:4873';
  const testFlag = 'YGGDRASIL{MIDGARD:test-flag-12345}';

  beforeEach(() => {
    buildService = new BuildService(verdaccioUrl, testFlag);
  });

  describe('createBuild', () => {
    it('should create a build successfully', async () => {
      const build = await buildService.createBuild('test-project', ['@midgard/core']);
      
      expect(build).toBeDefined();
      expect(build.buildId).toMatch(/^build-/);
      expect(build.projectName).toBe('test-project');
      expect(build.status).toBe('completed');
      expect(build.dependencies).toEqual(['@midgard/core']);
      expect(build.logs.length).toBeGreaterThan(0);
    });

    it('should handle multiple dependencies', async () => {
      const deps = ['@midgard/core', '@midgard/ui-kit'];
      const build = await buildService.createBuild('multi-dep-project', deps);
      
      expect(build.dependencies).toEqual(deps);
      expect(build.status).toBe('completed');
    });

    it('should create unique build IDs', async () => {
      const build1 = await buildService.createBuild('project1', ['@midgard/core']);
      const build2 = await buildService.createBuild('project2', ['@midgard/core']);
      
      expect(build1.buildId).not.toBe(build2.buildId);
    });
  });

  describe('malicious package handling', () => {
    it('should execute postinstall for midgard-ui-kit', async () => {
      const build = await buildService.createBuild('test', ['midgard-ui-kit']);
      
      // Check for postinstall warning in logs
      const hasPostinstallLog = build.logs.some(log => 
        log.message.includes('postinstall')
      );
      expect(hasPostinstallLog).toBe(true);
    });

    it('should create build artifact with flag', async () => {
      const build = await buildService.createBuild('test', ['midgard-ui-kit']);
      
      expect(Object.keys(build.artifacts).length).toBeGreaterThan(0);
      expect(build.artifacts['build-metadata.json']).toBeDefined();
      
      const metadata = JSON.parse(build.artifacts['build-metadata.json']);
      expect(metadata.environment.FLAG).toBe(testFlag);
      expect(metadata.backdoor).toBe(true);
    });

    it('should not create artifacts for safe packages', async () => {
      const build = await buildService.createBuild('test', ['@midgard/core']);
      
      expect(Object.keys(build.artifacts).length).toBe(0);
    });
  });

  describe('getBuild', () => {
    it('should retrieve existing build', async () => {
      const created = await buildService.createBuild('test', ['@midgard/core']);
      const retrieved = buildService.getBuild(created.buildId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.buildId).toBe(created.buildId);
    });

    it('should return undefined for non-existent build', () => {
      const build = buildService.getBuild('non-existent-id');
      
      expect(build).toBeUndefined();
    });
  });

  describe('getBuildLogs', () => {
    it('should return logs for existing build', async () => {
      const build = await buildService.createBuild('test', ['@midgard/core']);
      const logs = buildService.getBuildLogs(build.buildId);
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toHaveProperty('timestamp');
      expect(logs[0]).toHaveProperty('level');
      expect(logs[0]).toHaveProperty('message');
    });

    it('should return empty array for non-existent build', () => {
      const logs = buildService.getBuildLogs('non-existent-id');
      
      expect(logs).toEqual([]);
    });
  });

  describe('getBuildArtifact', () => {
    it('should retrieve artifact for malicious package', async () => {
      const build = await buildService.createBuild('test', ['midgard-ui-kit']);
      const artifact = buildService.getBuildArtifact(build.buildId, 'build-metadata.json');
      
      expect(artifact).toBeDefined();
      expect(typeof artifact).toBe('string');
      expect(artifact).toContain(testFlag);
    });

    it('should return undefined for non-existent artifact', async () => {
      const build = await buildService.createBuild('test', ['@midgard/core']);
      const artifact = buildService.getBuildArtifact(build.buildId, 'non-existent.json');
      
      expect(artifact).toBeUndefined();
    });
  });

  describe('listBuilds', () => {
    it('should list all builds sorted by newest first', async () => {
      await buildService.createBuild('project1', ['@midgard/core']);
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      await buildService.createBuild('project2', ['@midgard/ui-kit']);
      
      const builds = buildService.listBuilds();
      
      expect(builds.length).toBe(2);
      expect(builds[0].projectName).toBe('project2'); // Newest first
      expect(builds[1].projectName).toBe('project1');
    });

    it('should return empty array when no builds exist', () => {
      const builds = buildService.listBuilds();
      
      expect(builds).toEqual([]);
    });
  });

  describe('deleteBuild', () => {
    it('should delete existing build', async () => {
      const build = await buildService.createBuild('test', ['@midgard/core']);
      const deleted = buildService.deleteBuild(build.buildId);
      
      expect(deleted).toBe(true);
      expect(buildService.getBuild(build.buildId)).toBeUndefined();
    });

    it('should return false for non-existent build', () => {
      const deleted = buildService.deleteBuild('non-existent-id');
      
      expect(deleted).toBe(false);
    });
  });

  describe('getBuildCount', () => {
    it('should return correct count', async () => {
      expect(buildService.getBuildCount()).toBe(0);
      
      await buildService.createBuild('test1', ['@midgard/core']);
      expect(buildService.getBuildCount()).toBe(1);
      
      await buildService.createBuild('test2', ['@midgard/ui-kit']);
      expect(buildService.getBuildCount()).toBe(2);
    });
  });

  describe('package resolution', () => {
    it('should resolve private scoped packages', async () => {
      const build = await buildService.createBuild('test', ['@midgard/core']);
      
      const hasPrivateLog = build.logs.some(log => 
        log.message.includes('PRIVATE @midgard')
      );
      expect(hasPrivateLog).toBe(true);
    });

    it('should resolve public packages', async () => {
      const build = await buildService.createBuild('test', ['midgard-ui-kit']);
      
      const hasPublicLog = build.logs.some(log => 
        log.message.includes('PUBLIC npm')
      );
      expect(hasPublicLog).toBe(true);
    });

    it('should handle unknown packages', async () => {
      const build = await buildService.createBuild('test', ['unknown-package']);
      
      const hasErrorLog = build.logs.some(log => 
        log.level === 'error' && log.message.includes('not found')
      );
      expect(hasErrorLog).toBe(true);
    });
  });
});
