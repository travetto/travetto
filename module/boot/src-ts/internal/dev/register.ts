// @ts-ignore
import * as Mod from 'module';

import { AppCache } from '../../cache';
import { EnvUtil } from '../../env';
import { readPackage } from '../package';
import { Package } from '../../main-package';
import { PathUtil } from '../../path';
import { ModuleManager } from '../module';
import { ModType } from '../module-util';
import { TranspileUtil } from '../transpile-util';

export const Module = Mod as unknown as ModType;

type DevConfig = {
  entries: Record<string, string>;
  env: Record<string, string | number>;
};

class DevRegister {

  static TRV_MOD = /(@travetto\/[^= ,]+)(\s*=[^,]+)?(,)?/g;
  static DEFAULT_MODS = new Set(['@travetto/test', '@travetto/cli', '@travetto/doc']);

  /** Naive hashing */
  static naiveHash(text: string) {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /**
   * Resolve filename for dev mode
   */
  static resolveFilename(p: string) {
    if (p.includes('@travetto')) {
      const [, key, sub] = p.match(/^.*(@travetto\/[^/]+)(\/?.*)?$/) ?? [];
      const match = EnvUtil.getDynamicModules()[key!];
      if (match) {
        p = `${match}${sub ?? ''}`;
      } else {
        if (key === Package.name) {
          p = PathUtil.resolveUnix(sub ? `./${sub}` : Package.main);
        }
      }
    }
    return p;
  }

  /** Gather all dependencies of the module */
  static readDeps(givenMods: Iterable<string>): DevConfig {
    const keys = [
      ...givenMods, // Givens
      ...Object.keys(Package.dependencies || {}),
      ...Object.keys(Package.devDependencies || {}),
      ...Object.keys(process.argv[2] === 'doc' ? Package.docDependencies || {} : {})
    ]
      .filter(x => x.startsWith('@travetto'));

    const final = new Map();

    while (keys.length) {
      const top = keys.shift()!;
      final.set(top, null);
      const deps = readPackage(PathUtil.resolveFrameworkPath(top)).dependencies ?? {};

      for (const sub of Object.keys(deps)) {
        if (sub.startsWith('@travetto') && !final.has(sub)) {
          keys.push(sub);
        }
      }
    }

    return {
      env: {
        TIME: Date.now(),
        ...Object.fromEntries(Object
          .entries(process.env)
          .filter(([k]) => /^(TRV_.*|NODE_.*|PATH|DEBUG)$/.test(k))
          .sort((a, b) => a[0].localeCompare(b[0]))),
      },
      entries: Object.fromEntries([...final.entries()].filter(([k, v]) => k !== Package.name))
    };
  }

  static getMods(envMods: string) {
    const mods = new Set(this.DEFAULT_MODS);
    envMods.replace(this.TRV_MOD, (_, m) => mods.add(m) && '');
    return mods;
  }

  static getContent(envMods: string) {
    return AppCache.getOrSet(`isolated-modules.${this.naiveHash(envMods)}.json`,
      () => JSON.stringify(this.readDeps(this.getMods(envMods)), null, 2)
    );
  }

  static run() {
    const envMods = process.env.TRV_MODULES ?? '';
    if (envMods && !process.env.TRV_CACHE) { // Is specifying modules, build out
      // @ts-expect-error
      AppCache.cacheDir = `.trv_cache_${this.naiveHash(process.env.TRV_MODULES)}`;
    }

    AppCache.init(true);
    const { entries } = JSON.parse(this.getContent(envMods)) as DevConfig;
    process.env.TRV_MODULES = `${envMods.replace(this.TRV_MOD, '')},${Object.entries(entries).map(([k, v]) => `${k}=${v ?? ''}`).join(',')}`;

    // Override compiler options
    const key = `@travetto/${'*'}`;
    TranspileUtil['optionsExtra'] = {
      rootDir: process.env.TRV_DEV_ROOT!,
      paths: { [key]: [PathUtil.resolveFrameworkPath(key)] }
    };

    // Override filename resolution
    ModuleManager['resolveFilename'] = p => this.resolveFilename(p);

    ModuleManager.init();
  }
}

DevRegister.run();