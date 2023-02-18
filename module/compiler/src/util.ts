import ts from 'typescript';

import { ManifestContext, ManifestModuleFileType, ManifestRoot, Package, path } from '@travetto/manifest';

type OutputToSource = (outputFile: string) => ({ source: string } | undefined);
export type FileWatchEvent = { type: 'create' | 'delete' | 'update', path: string };

const nativeCwd = process.cwd();

/**
 * Standard utilities for compiler
 */
export class CompilerUtil {

  /**
   * Determine if this is a manifest file we care about
   */
  static validFile = (type: ManifestModuleFileType): boolean => type === 'ts' || type === 'package-json' || type === 'js';

  /**
   * Map input file to output format, generally converting ts extensions to js
   * @param file
   * @returns
   */
  static inputToOutput(file: string): string {
    return file.replace(/[.][tj]s$/, '.js');
  }

  /**
   * Determines if write callback data has sourcemap information
   * @param data
   * @returns
   */
  static isSourceMapUrlPosData(data?: ts.WriteFileCallbackData): data is { sourceMapUrlPos: number } {
    return data !== undefined && data !== null && typeof data === 'object' && ('sourceMapUrlPos' in data);
  }

  /**
   * Rewrite's sourcemap locations to real folders
   * @returns
   */
  static rewriteSourceMap(ctx: ManifestContext, text: string, outputToSource: OutputToSource): string {
    const data: { sourceRoot?: string, sources: string[] } = JSON.parse(text);
    const output = this.inputToOutput(path.resolve(ctx.workspacePath, ctx.outputFolder, data.sources[0]));
    const { source: file } = outputToSource(output) ?? {};

    if (file) {
      delete data.sourceRoot;
      data.sources = [file];
      text = JSON.stringify(data);
    }
    return text;
  }

  /**
   * Rewrite's inline sourcemap locations to real folders
   * @param text
   * @param outputToSource
   * @param writeData
   * @returns
   */
  static rewriteInlineSourceMap(
    ctx: ManifestContext,
    text: string,
    outputToSource: OutputToSource,
    { sourceMapUrlPos }: ts.WriteFileCallbackData & { sourceMapUrlPos: number }
  ): string {
    const sourceMapUrl = text.substring(sourceMapUrlPos);
    const [prefix, sourceMapData] = sourceMapUrl.split('base64,');
    const rewritten = this.rewriteSourceMap(ctx, Buffer.from(sourceMapData, 'base64url').toString('utf8'), outputToSource);
    return [
      text.substring(0, sourceMapUrlPos),
      prefix,
      'base64,',
      Buffer.from(rewritten, 'utf8').toString('base64url')
    ].join('');
  }

  /**
   * Rewrites the package.json to target .js files instead of .ts files, and pins versions
   * @param manifest
   * @param file
   * @param text
   * @returns
   */
  static rewritePackageJSON(manifest: ManifestRoot, text: string): string {
    const pkg: Package = JSON.parse(text);
    if (pkg.files) {
      pkg.files = pkg.files.map(x => this.inputToOutput(x));
    }
    if (pkg.main) {
      pkg.main = this.inputToOutput(pkg.main);
    }
    pkg.type = manifest.moduleType;
    for (const key of ['devDependencies', 'dependencies', 'peerDependencies'] as const) {
      if (key in pkg) {
        for (const dep of Object.keys(pkg[key] ?? {})) {
          if (dep in manifest.modules) {
            pkg[key]![dep] = manifest.modules[dep].version;
          }
        }
      }
    }
    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Build transpilation error
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static buildTranspileError(filename: string, diagnostics: Error | readonly ts.Diagnostic[]): Error {
    if (diagnostics instanceof Error) {
      return diagnostics;
    }

    const errors: string[] = diagnostics.slice(0, 5).map(diag => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      if (diag.file) {
        const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
        return ` @ ${diag.file.fileName.replace(nativeCwd, '.')}(${line + 1}, ${character + 1}): ${message}`;
      } else {
        return ` ${message}`;
      }
    });

    if (diagnostics.length > 5) {
      errors.push(`${diagnostics.length - 5} more ...`);
    }
    return new Error(`Transpiling ${filename.replace(nativeCwd, '.')} failed: \n${errors.join('\n')}`);
  }

  /**
   * Naive hashing
   */
  static naiveHash(text: string): number {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }
}