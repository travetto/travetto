import { ManifestModuleUtil, type ManifestRoot, type Package } from '@travetto/manifest';
import type { CompileEmitError } from './types.ts';
import { tsProxy as ts } from './ts-proxy.ts';

const nativeCwd = process.cwd();

/**
 * Standard utilities for compiler
 */
export class CompilerUtil {

  /**
   * Rewrites the package.json to target output file names, and pins versions
   * @param manifest
   * @param file
   * @param text
   * @returns
   */
  static rewritePackageJSON(manifest: ManifestRoot, text: string): string {
    const pkg: Package = JSON.parse(text);
    if (pkg.files) {
      pkg.files = pkg.files.map(file => ManifestModuleUtil.withOutputExtension(file));
    }
    if (pkg.main) {
      pkg.main = ManifestModuleUtil.withOutputExtension(pkg.main);
    }
    pkg.type = 'module';
    for (const key of ['devDependencies', 'dependencies', 'peerDependencies'] as const) {
      if (key in pkg) {
        for (const dependency of Object.keys(pkg[key] ?? {})) {
          if (dependency in manifest.modules) {
            pkg[key]![dependency] = manifest.modules[dependency].version;
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
  static buildTranspileError(filename: string, diagnostics: CompileEmitError): Error {
    if (diagnostics instanceof Error) {
      return diagnostics;
    }

    const errors: string[] = diagnostics.slice(0, 5).map(diag => {
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