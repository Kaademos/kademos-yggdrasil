/**
 * BuildService - CI/CD Build Simulator
 * 
 * OWASP A03:2025 - Software Supply Chain Failures
 * VULNERABLE: Simulates npm install with dependency confusion and postinstall execution
 * 
 * This service simulates a realistic CI/CD build process:
 * - Resolves packages from Verdaccio registry
 * - Executes postinstall scripts (VULNERABLE)
 * - Generates build logs and artifacts
 * - Exposes environment variables to malicious packages
 */

import { randomUUID } from 'crypto';

export interface BuildLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface Build {
  buildId: string;
  projectName: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  dependencies: string[];
  logs: BuildLog[];
  artifacts: Record<string, string>;
}

export interface PackageInfo {
  name: string;
  version: string;
  registry: 'public' | 'private';
  hasPostinstall: boolean;
}

export class BuildService {
  private builds: Map<string, Build> = new Map();
  private readonly verdaccioUrl: string;
  private readonly flag: string;

  constructor(verdaccioUrl: string, flag: string) {
    this.verdaccioUrl = verdaccioUrl;
    this.flag = flag;
  }

  /**
   * Create a new build with specified dependencies
   * VULNERABLE: No validation of package sources or postinstall scripts
   */
  async createBuild(
    projectName: string,
    dependencies: string[]
  ): Promise<Build> {
    const buildId = `build-${Date.now()}-${randomUUID().substring(0, 8)}`;
    
    const build: Build = {
      buildId,
      projectName,
      status: 'running',
      startTime: Date.now(),
      dependencies,
      logs: [],
      artifacts: {},
    };

    this.builds.set(buildId, build);
    this.addLog(buildId, 'info', `🔨 Build ${buildId} started`);
    this.addLog(buildId, 'info', `📦 Project: ${projectName}`);
    this.addLog(buildId, 'info', `📋 Dependencies: ${dependencies.length}`);
    this.addLog(buildId, 'info', '');

    // Process dependencies sequentially
    for (const dep of dependencies) {
      await this.installPackage(buildId, dep);
    }

    // Finalize build
    build.status = 'completed';
    build.endTime = Date.now();
    const duration = build.endTime - build.startTime;
    this.addLog(buildId, 'info', '');
    this.addLog(buildId, 'info', `✅ Build completed in ${duration}ms`);

    return build;
  }

  /**
   * Install a single package
   * VULNERABLE: Resolves from Verdaccio without scope verification
   * Simulates realistic npm install behavior
   */
  private async installPackage(buildId: string, packageName: string): Promise<void> {
    const build = this.builds.get(buildId);
    if (!build) return;
    
    this.addLog(buildId, 'info', `📥 Installing ${packageName}...`);

    try {
      // Simulate package resolution
      const packageInfo = this.resolvePackage(packageName);
      
      if (!packageInfo) {
        this.addLog(buildId, 'error', `❌ Package ${packageName} not found`);
        return;
      }

      // Log resolution details
      // SPOILER: Shows which registry was used
      const registryLabel = packageInfo.registry === 'public' ? 'PUBLIC npm' : 'PRIVATE @midgard';
      this.addLog(buildId, 'info', `   Resolved: ${packageInfo.name}@${packageInfo.version}`);
      this.addLog(buildId, 'info', `   Registry: ${registryLabel}`);

      // VULNERABLE: Execute postinstall scripts without validation
      if (packageInfo.hasPostinstall) {
        this.addLog(buildId, 'warn', `   ⚠️  Running postinstall script...`);
        await this.executePostinstall(buildId, packageInfo);
        this.addLog(buildId, 'warn', `   ⚠️  Postinstall script completed`);
      }

      this.addLog(buildId, 'info', `   ✓ ${packageName} installed`);
      this.addLog(buildId, 'info', '');

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addLog(buildId, 'error', `❌ Installation failed: ${errorMessage}`);
    }
  }

  /**
   * Resolve package info (simulated)
   * VULNERABLE: Public packages checked via naming pattern
   */
  private resolvePackage(packageName: string): PackageInfo | null {
    // Simulate private packages (scoped)
    if (packageName === '@midgard/ui-kit') {
      return {
        name: '@midgard/ui-kit',
        version: '1.0.0',
        registry: 'private',
        hasPostinstall: false,
      };
    }

    if (packageName === '@midgard/core') {
      return {
        name: '@midgard/core',
        version: '1.5.0',
        registry: 'private',
        hasPostinstall: false,
      };
    }

    // VULNERABLE: Public typosquat packages
    if (packageName === 'midgard-ui-kit') {
      return {
        name: 'midgard-ui-kit',
        version: '1.0.1',  // Higher version than private
        registry: 'public',
        hasPostinstall: true,  // EXPLOIT: Malicious postinstall
      };
    }

    if (packageName === 'midgard-utils-v2') {
      return {
        name: 'midgard-utils-v2',
        version: '1.0.0',
        registry: 'public',
        hasPostinstall: false,
      };
    }

    return null; // Package not found
  }

  /**
   * Execute postinstall script
   * VULNERABLE: Runs untrusted code with access to environment variables
   * EXPLOIT: Malicious package exfiltrates FLAG to build artifacts
   */
  private async executePostinstall(buildId: string, packageInfo: PackageInfo): Promise<void> {
    const build = this.builds.get(buildId);
    if (!build) return;

    // Simulate postinstall execution delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // EXPLOIT: Malicious package accesses environment
    if (packageInfo.name === 'midgard-ui-kit') {
      this.addLog(buildId, 'warn', `   📝 Package writing to build artifacts...`);
      
      // FLAG HERE: Exfiltrated via build metadata artifact
      const buildMetadata = {
        buildId,
        packageName: packageInfo.name,
        packageVersion: packageInfo.version,
        timestamp: Date.now(),
        environment: {
          NODE_ENV: process.env.NODE_ENV || 'production',
          CI: 'true',
          BUILD_ID: buildId,
          // VULNERABLE: Flag exposed in environment
          FLAG: this.flag,
          REGISTRY: packageInfo.registry,
        },
        backdoor: true,
        message: 'Supply chain compromise successful!',
        // SPOILER: Analysis for educational purposes
        analysis: {
          vulnerability: 'OWASP A03:2025 - Software Supply Chain Failures',
          attack: 'Dependency confusion + malicious postinstall',
          exfiltrated: 'Environment variables including FLAG',
        },
      };

      // Store as downloadable artifact
      const artifactName = 'build-metadata.json';
      const artifactContent = JSON.stringify(buildMetadata, null, 2);
      build.artifacts[artifactName] = artifactContent;

      this.addLog(buildId, 'warn', `   ⚠️  Artifact created: ${artifactName}`);
      this.addLog(buildId, 'warn', `   ⚠️  Package accessed environment variables!`);
    }
  }

  /**
   * Add log entry to build
   */
  private addLog(
    buildId: string,
    level: BuildLog['level'],
    message: string,
    details?: Record<string, unknown>
  ): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    build.logs.push({
      timestamp: Date.now(),
      level,
      message,
      details,
    });
  }

  /**
   * Get build by ID
   */
  getBuild(buildId: string): Build | undefined {
    return this.builds.get(buildId);
  }

  /**
   * List all builds
   */
  listBuilds(): Build[] {
    return Array.from(this.builds.values())
      .sort((a, b) => b.startTime - a.startTime); // Newest first
  }

  /**
   * Get build logs
   */
  getBuildLogs(buildId: string): BuildLog[] {
    const build = this.builds.get(buildId);
    return build?.logs || [];
  }

  /**
   * Get build artifact
   */
  getBuildArtifact(buildId: string, artifactName: string): string | undefined {
    const build = this.builds.get(buildId);
    return build?.artifacts[artifactName];
  }

  /**
   * Get all artifacts for a build
   */
  getBuildArtifacts(buildId: string): Record<string, string> {
    const build = this.builds.get(buildId);
    return build?.artifacts || {};
  }

  /**
   * Delete build (cleanup)
   */
  deleteBuild(buildId: string): boolean {
    return this.builds.delete(buildId);
  }

  /**
   * Get build count
   */
  getBuildCount(): number {
    return this.builds.size;
  }
}
