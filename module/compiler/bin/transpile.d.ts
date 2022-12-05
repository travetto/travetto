import type { ManifestContext, Package } from '@travetto/manifest';

declare namespace Transpile {
  type CompileCommand = 'build' | 'watch' | 'clean' | 'manifest';

  /**
   * Writes a package json file
   */
  function writePackageJson(ctx: ManifestContext, inputFile: string, outputFile: string, transform?: (pkg: Package) => Package): Promise<void>;

  /**
   * Transpiles a file
   */
  function transpileFile(ctx: ManifestContext, inputFile: string, outputFile: string): Promise<void>;

  /**
   * Write js file
   */
  function writeJsFile(ctx: ManifestContext, inputFile: string, outputFile: string): Promise<void>;

  /**
   * Build an entire package
   */
  function buildPackage(ctx: ManifestContext, name: string, sourcePath: string, mainSource: string, extraSource: string[]): Promise<string>;

  /**
   * Get Context for building
   */
  function getContext(op?: CompileCommand): Promise<ManifestContext>;
}

export = Transpile;