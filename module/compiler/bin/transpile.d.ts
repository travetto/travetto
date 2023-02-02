import type { ManifestContext } from '@travetto/manifest';

declare namespace Transpile {
  /**
   * Output a file, support for ts, js, and package.json
   */
  function writeFile(ctx: ManifestContext, inputFile: string, outputFile: string): Promise<void>;

  /**
   * Build an entire package
   */
  function getCompilerOptions(ctx: ManifestContext): Promise<{}>;
}

export = Transpile;