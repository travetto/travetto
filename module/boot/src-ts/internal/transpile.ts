import * as sourceMapSupport from 'source-map-support';

import { TranspileUtil, TypescriptCompilerOptions } from './transpile-util';
import { TranspileCache } from './transpile-cache';
import { ModuleIndexEntry } from './module';
import { Host } from '../host';
import { EnvUtil } from '../env';
import { PathUtil } from '../path';
import { FsUtil } from '../fs';

/**
 * Transpilation manager
 */
class $TranspileManager {
  private transpile: (filename: string) => string;

  #initialized = false;
  #options: Record<string, unknown>; // Untyped so that the typescript typings do not make it into the API
  #optionsExtra?: TypescriptCompilerOptions;

  /**
   * Set extra transpiler options
   * @privates
   */
  setExtraOptions(opts: TypescriptCompilerOptions): void {
    this.#optionsExtra = { ...this.#optionsExtra ?? {}, ...opts };
  }

  /**
   * Get loaded compiler options
   */
  get compilerOptions(): TypescriptCompilerOptions {
    if (!this.#options) {
      const opts = this.#optionsExtra ?? {};
      const rootDir = opts.rootDir ?? PathUtil.cwd;
      const projTsconfig = PathUtil.resolveUnix('tsconfig.json');
      const baseTsconfig = PathUtil.resolveUnix(__dirname, '..', '..', 'tsconfig.trv.json');
      // Fallback to base tsconfig if not found in local folder
      const config = FsUtil.existsSync(projTsconfig) ? projTsconfig : baseTsconfig;

      this.#options = {
        ...TranspileUtil.readTsConfigOptions(config),
        rootDir,
        outDir: rootDir,
        sourceRoot: rootDir,
        ...opts
      };
    }
    return this.#options;
  }


  /**
   * Set transpiler triggered on require
   */
  setTranspiler(fn: (file: string) => string): void {
    this.transpile = fn;
  }

  /**
   * Set file reading logic
   * @param fn
   */
  setSourceMapSource(fn: (file: string) => string | undefined): void {
    // Register source maps for cached files
    sourceMapSupport.install({
      emptyCacheBetweenOperations: EnvUtil.isDynamic(),
      retrieveFile: p => fn(TranspileUtil.toUnixSource(p))!
    });
  }

  /**
   * Compile and transpile a source file
   * @param m node module
   * @param sourceFile filename
   */
  compile(m: NodeJS.Module, sourceFile: string): unknown {
    let content = this.transpile(sourceFile);
    const outputFile = sourceFile.replace(Host.EXT.inputRe, Host.EXT.output);
    try {
      return m._compile(content, outputFile);
    } catch (err: unknown) {
      if (!(err instanceof Error)) {
        throw err;
      }
      content = TranspileUtil.handlePhaseError('compile', sourceFile, err);
      return m._compile(content, outputFile);
    }
  }

  /**
   * Transpile, and cache
   * @param tsf The typescript file to transpile
   * @param force Force transpilation, even if cached
   */
  simpleTranspile(tsf: string, force = false): string {
    return TranspileCache.getOrSet(tsf, () => TranspileUtil.simpleTranspile(tsf, this.compilerOptions), force);
  }

  /**
   * Enable transpilation hooks
   */
  init(): void {
    if (this.#initialized || EnvUtil.isCompiled()) {
      return;
    }

    require.extensions[Host.EXT.input] = (...args): unknown => this.compile(...args);
    this.setTranspiler(f => this.simpleTranspile(f));
    this.setSourceMapSource(f => TranspileCache.readOptionalEntry(f));
    TranspileCache.init(true);

    this.#initialized = true;
  }

  /**
   * Resets transpilation hooks
   */
  reset(): void {
    if (!this.#initialized) {
      return;
    }

    delete require.extensions[Host.EXT.input];
    this.#initialized = false;
  }

  /**
   * Transpile all found
   * @param entries
   */
  transpileAll(entries: ModuleIndexEntry[]): void {
    if (EnvUtil.isCompiled()) {
      return; // Do nothing
    }

    // Ensure we transpile all files
    for (const { file } of entries) {
      if (!TranspileCache.hasEntry(file)) {
        this.transpile(file);
      }
    }
  }
}

export const TranspileManager = new $TranspileManager();