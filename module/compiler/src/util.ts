import ts from 'typescript';
import fs from 'fs/promises';
import { readdirSync } from 'fs';

import { ManifestModule, ManifestRoot, Package, PackageUtil, path } from '@travetto/manifest';

type InputToSource = (inputFile: string) => ({ source: string, module: ManifestModule } | undefined);
export type FileWatchEvent = { type: 'create' | 'delete' | 'update', path: string };

const nativeCwd = process.cwd();

/**
 * Standard utilities for compiler
 */
export class CompilerUtil {

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
  static rewriteSourceMap(text: string, inputToSource: InputToSource): string {
    const data: { sourceRoot: string, sources: string[] } = JSON.parse(text);
    const [src] = data.sources;

    const { source: file, module } = inputToSource(src) ?? {};
    if (file && module) {
      data.sourceRoot = module.source;
      data.sources = [file.replace(`${module.source}/`, './')];
      text = JSON.stringify(data);
    }

    return text;
  }

  /**
   * Rewrite's inline sourcemap locations to real folders
   * @param text
   * @param inputToSource
   * @param writeData
   * @returns
   */
  static rewriteInlineSourceMap(
    text: string,
    inputToSource: InputToSource,
    { sourceMapUrlPos }: ts.WriteFileCallbackData & { sourceMapUrlPos: number }
  ): string {
    const sourceMapUrl = text.substring(sourceMapUrlPos);
    const [prefix, sourceMapData] = sourceMapUrl.split('base64,');
    const rewritten = this.rewriteSourceMap(Buffer.from(sourceMapData, 'base64url').toString('utf8'), inputToSource);
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
  static rewritePackageJSON(manifest: ManifestRoot, text: string, opts: ts.CompilerOptions): string {
    const pkg: Package = JSON.parse(text);
    if (pkg.files) {
      pkg.files = pkg.files.map(x => x.replace(/[.]ts$/, '.js'));
    }
    if (pkg.main) {
      pkg.main = pkg.main.replace(/[.]ts$/, '.js');
    }
    pkg.type = opts.module !== ts.ModuleKind.CommonJS ? 'module' : 'commonjs';
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
   * Read the given tsconfig.json values for the project
   * @param path
   * @returns
   */
  static async readTsConfigOptions(file: string): Promise<ts.CompilerOptions> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(file, ts.sys.readFile), ts.sys, nativeCwd
    );
    options.target = ts.ScriptTarget.ESNext;
    return options;
  }

  /**
   * Build transpilation error
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static buildTranspileError(filename: string, diagnostics: readonly ts.Diagnostic[]): Error {
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
   * Allows for watching of explicit folders
   *
   * @param onEvent
   * @returns
   */
  static async fileWatcher(
    folders: string[],
    onEvent: (ev: FileWatchEvent, folder: string) => void
  ): Promise<() => Promise<void>> {
    const watcher = await import('@parcel/watcher');
    const subs: ReturnType<(typeof watcher)['subscribe']>[] = [];
    for (const folder of folders) {
      const sub = watcher.subscribe(folder, (err, events) => {
        for (const ev of events) {
          onEvent(ev, folder);
        }
      }, { ignore: ['node_modules', ...readdirSync(folder).filter(x => x.startsWith('.') && x.length > 2)] });
      subs.push(sub);
    }
    const readiedSubs = await Promise.all(subs);
    return () => Promise.all(readiedSubs.map(s => s.unsubscribe())).then(() => { });
  }

  /**
   * Get loaded compiler options
   */
  static async getCompilerOptions(outputFolder: string, bootTsConfig: string, workspace: string): Promise<ts.CompilerOptions> {
    const opts: Partial<ts.CompilerOptions> = {};
    const rootDir = nativeCwd;
    const projTsconfig = path.resolve('tsconfig.json');
    // Fallback to base tsconfig if not found in local folder
    const config = (await fs.stat(projTsconfig).catch(() => false)) ? projTsconfig : bootTsConfig;
    const base = await CompilerUtil.readTsConfigOptions(config);

    const { type } = PackageUtil.readPackage(workspace);

    if (type !== undefined) {
      base.module = `${type}`.toLowerCase() === 'commonjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
    }

    return {
      ...base,
      resolveJsonModule: true,
      allowJs: true,
      outDir: outputFolder,
      sourceRoot: rootDir,
      ...opts,
      rootDir,
    };
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