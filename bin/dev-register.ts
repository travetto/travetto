import { AppCache } from '../module/boot/src/cache';
import { EnvUtil } from '../module/boot/src/env';
import { readPackage } from '../module/boot/src/internal/package';
import { Package } from '../module/boot/src/main-package';
import { PathUtil } from '../module/boot/src/path';
import { TranspileManager } from '../module/boot/src/internal/transpile';
import { TranspileUtil } from '../module/boot/src/internal/transpile-util';
import { SystemUtil } from '../module/boot/src/internal/system';
import { ModuleCompileCache } from '../module/boot/src/internal/module-cache';

type DevConfig = {
  entries: Record<string, string>;
  env: Record<string, string | number>;
};

class DevRegister {

  static #trvMod = /(@travetto\/[^= ,]+)(\s*=[^,]+)?(,)?/g;
  static #defaultMods = new Set(['@travetto/test', '@travetto/cli', '@travetto/doc']);

  /**
   * Resolve filename for dev mode
   */
  static resolveFilename(p: string): string {
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
      ...(process.argv[2] === 'doc' ? [
        ...Object.keys(Package.docDependencies ?? {}),
        ...Object.keys(Package.peerDependencies ?? {})
      ] : [])
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
      env: { TIME: Date.now(), DEBUG: process.env.DEBUG!, ...EnvUtil.getAll(), },
      entries: Object.fromEntries([...final.entries()].filter(([k, v]) => k !== Package.name))
    };
  }

  static getMods(envMods: string): Set<string> {
    const mods = new Set(this.#defaultMods);
    envMods.replace(this.#trvMod, (_, m) => mods.add(m) && '');
    return mods;
  }

  static getContent(envMods: string): string {
    return AppCache.getOrSet('isolated-modules.json',
      () => JSON.stringify(this.readDeps(this.getMods(envMods)), null, 2)
    );
  }

  static run(): void {
    const envMods = process.env.TRV_MODULES || '';
    if (envMods && !process.env.TRV_CACHE) { // Is specifying modules, build out
      const uniqueId = SystemUtil.naiveHash(process.env.TRV_MODULES || '');
      // @ts-expect-error
      AppCache.cacheDir = `.app_cache/${uniqueId}`;
      // @ts-expect-error
      ModuleCompileCache.cacheDir = `.trv_cache_${uniqueId}`;
    }

    ModuleCompileCache.init(true);
    const { entries }: DevConfig = JSON.parse(this.getContent(envMods));
    process.env.TRV_MODULES = `${envMods.replace(this.#trvMod, '')},${Object.entries(entries).map(([k, v]) => `${k}=${v ?? ''}`).join(',')}`
      .replace(/,=/g, '');

    // Override compiler options
    const key = '@travetto/*';
    TranspileUtil.setExtraOptions({
      rootDir: process.env.TRV_DEV_ROOT!,
      paths: { [key]: [PathUtil.resolveFrameworkPath(key)] }
    });

    // Override filename resolution
    TranspileManager.setFilenameResolver((p: string) => this.resolveFilename(p));

    TranspileManager.init();
  }
}

DevRegister.run();