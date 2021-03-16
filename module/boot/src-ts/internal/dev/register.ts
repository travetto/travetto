import { AppCache } from '../../cache';
import { Package } from '../../package';
import { ModuleManager } from '../module';

type DevConfig = {
  entries: string[];
  env: Record<string, string | number>;
};

class DevRegister {

  static TRV_MOD = /(@travetto\/[^= ,]+)(\s*=[^,]+)?(,)?/g;
  static DEFAULT_MODS = new Set(['@travetto/test', '@travetto/cli', '@travetto/doc', '@travetto/app', '@travetto/log']);

  /** Naive hashing */
  static naiveHash(text: string) {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /** Gather all dependencies of the module */
  static readDeps(givenMods: Iterable<string>): DevConfig {
    const keys = [
      ...givenMods, // Givens
      ...Object.keys(Package.dependencies || {}),
      ...Object.keys(Package.devDependencies || {})
    ]
      .filter(x => x.startsWith('@travetto'));

    const final = new Map();

    while (keys.length) {
      const top = keys.shift()!;
      final.set(top, null);
      const deps = require(`${top.replace('@travetto', process.env.TRV_DEV!)}/package.json`).dependencies ?? {};

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
          .filter(([k]) => k.startsWith('TRV_'))
          .sort((a, b) => a[0].localeCompare(b[0]))),
      },
      entries: [...final.entries()].filter(([k, v]) => k !== Package.name).map(x => x.join('='))
    };
  }

  static getMods(envMods: string) {
    const mods = new Set(DevRegister.DEFAULT_MODS);
    envMods.replace(DevRegister.TRV_MOD, (_, m) => mods.add(m) && '');
    return mods;
  }

  static getContent(envMods: string) {
    return AppCache.getOrSet(`isolated-modules.${this.naiveHash(envMods)}.json`,
      () => JSON.stringify(this.readDeps(this.getMods(envMods)), null, 2)
    );
  }

  static run() {
    const envMods = process.env.TRV_MODULES ?? '';
    if (envMods) { // Is specifying modules, build out
      // @ts-expect-error
      AppCache.cacheDir = `.trv_cache_${this.naiveHash(process.env.TRV_MODULES)}`;
    }

    AppCache.init(true);
    const { entries } = JSON.parse(this.getContent(envMods)) as DevConfig;
    process.env.TRV_MODULES = `${envMods.replace(DevRegister.TRV_MOD, '')},${entries.join(',')}`;
    // Force install
    ModuleManager.init();
  }
}

DevRegister.run();