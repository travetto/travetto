// @ts-expect-error
import * as Mod from 'module';

import { Package } from '../package';
import { EnvUtil } from '../env';
import { FsUtil } from '../fs';
import { SourceUtil } from './source';

type ModuleHandler<T = unknown> = (name: string, o: T) => T;

export type ModType = {
  loaded?: boolean;
  _load?(req: string, parent: ModType): unknown;
  _resolveFilename?(req: string, parent: ModType): string;
  _compile?(contents: string, file: string): unknown;
} & NodeJS.Module;

const Module = Mod as unknown as ModType;

/**
 * Module utils
 */
export class ModuleUtil {

  private static handlers: ModuleHandler[] = [];

  /**
   * Resolve filename for dev mode
   */
  static devResolveFilename(p: string) {
    if (p.includes('@travetto')) {
      const [, key, sub] = p.match(/^.*(@travetto\/[^/]+)(\/?.*)?$/) ?? [];
      const match = EnvUtil.getDynamicModules()[key!];
      if (match) {
        p = `${match}${sub! ?? ''}`;
      } else {
        if (key === Package.name) {
          p = FsUtil.resolveUnix(sub ? `./${sub}` : Package.main);
        }
      }
    }
    return p;
  }

  /**
   * Process error response
   * @param phase The load/compile phase to care about
   * @param tsf The typescript filename
   * @param err The error produced
   * @param filename The relative filename
   */
  static handlePhaseError(phase: 'load' | 'compile' | 'transpile', tsf: string, err: Error, filename = tsf.replace(FsUtil.cwd, '.')) {
    if (phase === 'compile' &&
      (err.message.startsWith('Cannot find module') || err.message.startsWith('Unable to load'))
    ) {
      err = new Error(`${err.message} ${err.message.includes('from') ? `[via ${filename}]` : `from ${filename}`}`);
    }

    if (EnvUtil.isWatch() && !filename.startsWith('test/')) {
      console.trace(`Unable to ${phase} ${filename}: stubbing out with error proxy.`, err.message);
      return SourceUtil.getErrorModule(err.message);
    }

    throw err;
  }

  /**
   * Add module post processor (post-load)
   *
   * @param handler The code to run on post module load
   */
  static addHandler(handler: ModuleHandler) {
    this.handlers.push(handler);
  }

  /**
   * Check for module cycles
   */
  static checkForCycles(mod: unknown, request: string, parent: ModType) {
    if (parent && !parent.loaded) { // Standard ts compiler output
      const desc = mod ? Object.getOwnPropertyDescriptors(mod) : {};
      if (!mod || !('ᚕtrv' in desc) || 'ᚕtrvError' in desc) {
        try {
          const p = Module._resolveFilename!(request, parent);
          if (p && p.endsWith(SourceUtil.EXT)) {
            throw new Error(`Unable to load ${p}, most likely a cyclical dependency`);
          }
        } catch (err) {
          // Ignore if we can't resolve
        }
      }
    }
  }

  /**
   * Handle module post processing
   */
  static handleModule(mod: unknown, request: string, parent: ModType) {
    if (this.handlers) {
      const name = Module._resolveFilename!(request, parent);
      for (const handler of this.handlers) {
        mod = handler(name, mod);
      }
    }
    return mod;
  }

  /**
   * Initialize module support
   */
  static init() {
    // Tag output to indicate it was succefully processed by the framework
    SourceUtil.addPreProcessor((__, contents) =>
      `${contents}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`);
  }

  /**
   * Clear out on cleanup
   */
  static reset() {
    this.handlers = [];
  }
}