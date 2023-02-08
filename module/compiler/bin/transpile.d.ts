import type { ManifestContext, Package } from '@travetto/manifest';

declare namespace Transpile {

  type ModFile = { input: string, output: string, stale: boolean };

  /**
   * Common logging support
   */
  function log(...args: unknown[]): void;

  /**
   * Precompile complier
   */
  function precompile(ctx: ManifestContext): Promise<void>;

  /**
   * Recompile folder if stale
   */
  function compileIfStale(ctx: ManifestContext, prefix: string, files: ModFile[]): Promise<void>;

  /**
   * Get sources for a given module
   */
  function getModuleSources(ctx: ManifestContext, module: string, seed: string[]): Promise<ModFile[]>;

  /**
   * Build an entire package
   */
  function getCompilerOptions(ctx: ManifestContext): Promise<{
    moduleType: Exclude<Package['type'], undefined>
  }>;

  /**
   * Add manifest context to node path
   */
  function addOutputToNodePath(ctx: ManifestContext): Promise<void>;

  /**
   * Get bootstrap
   */
  function getBootstrap(ctx: ManifestContext): Promise<typeof import('../support/bin/bootstrap')>
}

export = Transpile;