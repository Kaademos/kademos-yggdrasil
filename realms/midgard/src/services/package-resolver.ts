/**
 * Package Resolver Service - Midgard
 * 
 * OWASP A03:2025 - Supply Chain Failures
 * VULNERABLE: Resolves packages with ambiguous naming, allowing dependency confusion
 * 
 * This service simulates npm package resolution with a critical flaw:
 * it checks public registry before private registry, allowing attackers
 * to publish similarly-named packages that get loaded instead of internal ones.
 */

export interface Package {
  name: string;
  version: string;
  registry: 'public' | 'private';
  description: string;
  exports: Record<string, unknown>;
}

export class PackageResolverService {
  private publicRegistry: Map<string, Package> = new Map();
  private privateRegistry: Map<string, Package> = new Map();
  private installedPackages: Set<string> = new Set();

  constructor() {
    this.initializeRegistries();
  }

  /**
   * Initialize mock registries with packages
   */
  private initializeRegistries(): void {
    // Private packages (scoped, intended to be internal)
    this.privateRegistry.set('@midgard/ui-kit', {
      name: '@midgard/ui-kit',
      version: '2.1.0',
      registry: 'private',
      description: 'Internal UI components for Midgard applications',
      exports: {
        renderUI: () => '<div class="safe-ui">Legitimate UI Component</div>',
        version: '2.1.0',
      },
    });

    this.privateRegistry.set('@midgard/core', {
      name: '@midgard/core',
      version: '1.5.0',
      registry: 'private',
      description: 'Core utilities for Midgard platform',
      exports: {
        initialize: () => ({ status: 'initialized', safe: true }),
      },
    });

    // Public packages (malicious lookalikes)
    this.publicRegistry.set('midgard-ui-kit', {
      name: 'midgard-ui-kit',
      version: '2.1.1',
      registry: 'public',
      description: 'UI components for Midgard (MALICIOUS TYPOSQUAT)',
      exports: {
        renderUI: () => '<div class="malicious-ui">Safe UI Component</div>',
        // BACKDOOR: Exposes secret config
        getSecretConfig: (flag: string) => ({
          backdoor: true,
          message: 'Malicious package successfully loaded!',
          flag: flag,
          attacker: 'Supply Chain Compromise',
        }),
      },
    });

    this.publicRegistry.set('midgard-utils-v2', {
      name: 'midgard-utils-v2',
      version: '1.0.0',
      registry: 'public',
      description: 'Utilities for Midgard v2 (PUBLIC PACKAGE)',
      exports: {
        format: (str: string) => str.toUpperCase(),
      },
    });
  }

  /**
   * Resolve package by name
   * VULNERABLE: Checks public registry first, enabling dependency confusion
   */
  resolvePackage(packageName: string): Package | null {
    // VULNERABLE: Public registry checked BEFORE private registry
    // This is the critical flaw - allows typosquatting/confusion attacks
    
    if (this.publicRegistry.has(packageName)) {
      console.log(`[VULNERABLE] Resolving ${packageName} from PUBLIC registry`);
      return this.publicRegistry.get(packageName)!;
    }

    if (this.privateRegistry.has(packageName)) {
      console.log(`Resolving ${packageName} from private registry`);
      return this.privateRegistry.get(packageName)!;
    }

    return null;
  }

  /**
   * Get package from specific registry
   */
  getPackageFromRegistry(packageName: string, registry: 'public' | 'private'): Package | null {
    const reg = registry === 'public' ? this.publicRegistry : this.privateRegistry;
    return reg.get(packageName) || null;
  }

  /**
   * List all available packages
   */
  listPackages(): { public: Package[]; private: Package[] } {
    return {
      public: Array.from(this.publicRegistry.values()),
      private: Array.from(this.privateRegistry.values()),
    };
  }

  /**
   * Install package (simulate)
   */
  installPackage(packageName: string): Package | null {
    const pkg = this.resolvePackage(packageName);
    if (pkg) {
      this.installedPackages.add(packageName);
    }
    return pkg;
  }

  /**
   * Get installed packages
   */
  getInstalledPackages(): string[] {
    return Array.from(this.installedPackages);
  }

  /**
   * Check if package is installed
   */
  isInstalled(packageName: string): boolean {
    return this.installedPackages.has(packageName);
  }

  /**
   * Execute package export
   */
  executePackageFunction(packageName: string, functionName: string, ...args: unknown[]): unknown {
    const pkg = this.resolvePackage(packageName);
    if (!pkg) {
      throw new Error(`Package ${packageName} not found`);
    }

    const exportedFn = pkg.exports[functionName];
    if (typeof exportedFn !== 'function') {
      throw new Error(`Function ${functionName} not found in package ${packageName}`);
    }

    return (exportedFn as (...args: unknown[]) => unknown)(...args);
  }
}
