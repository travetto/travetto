import { TranspileUtil } from './transpile-util';
import { TranspileCache } from './transpile-cache';
import { ModuleIndexEntry } from './module';
import { Host } from '../host';
import { EnvUtil } from '../env';

/**
 * Transpilation manager
 */
export class TranspileManager {
  private static transpile: (filename: string) => string;

  static #initialized = false;

  /**
   * Set transpiler triggered on require
   */
  static setTranspiler(fn: (file: string) => string): void {
    this.transpile = fn;
  }

  /**
   * Compile and transpile a source file
   * @param m node module
   * @param sourceFile filename
   */
  static compile(m: NodeJS.Module, sourceFile: string): unknown {
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
  static simpleTranspile(tsf: string, force = false): string {
    return TranspileCache.getOrSet(tsf, () => TranspileUtil.simpleTranspile(tsf), force);
  }

  /**
   * Enable transpilation hooks
   */
  static init(): void {
    if (this.#initialized || EnvUtil.isCompiled()) {
      return;
    }

    require.extensions[Host.EXT.input] = (...args): unknown => this.compile(...args);
    this.setTranspiler(f => this.simpleTranspile(f));
    TranspileCache.init(true);

    this.#initialized = true;
  }

  /**
   * Resets transpilation hooks
   */
  static reset(): void {
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
  static transpileAll(entries: ModuleIndexEntry[]): void {
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