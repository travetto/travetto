// @ts-ignore
import * as Mod from 'module';
import * as path from 'path';

import { FsUtil } from './fs';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): any;
} & Mod;

const Module = Mod as any as Module;

/**
 * Framework specific utilities
 */
export class FrameworkUtil {

  private static readonly devCache = {
    boot: FsUtil.toUnix(path.resolve(__dirname, '..')),
    [require(FsUtil.joinUnix(FsUtil.cwd, 'package.json')).name.split('/')[1]]: FsUtil.cwd // Initial
  };

  /**
   * Only called in Framework dev mode
   * @param pth
   */
  static devResolve(pth: string, mod?: Module) {
    if (mod) {
      try {
        pth = Module._resolveFilename!(pth, mod);
      } catch{ }
    }

    pth = FsUtil.toUnix(pth);

    if (/travetto[^/]*\/module\/[^/]+\/bin/.test(pth)) { // Convert bin from framework module
      pth = `${FsUtil.cwd}/node_modules/@travetto/${pth.split(/\/module\//)[1]}`;
    }

    // If relative or framework
    if (pth.includes('@travetto')) {
      // Fetch current module's name
      // Handle self references
      pth = pth.replace(/^(.*\/@travetto)\/([^/]+)(\/[^@]*)?$/g, (all, pre, name, rest) => {
        if (!(name in this.devCache)) {
          const base = `${FsUtil.cwd}/node_modules/@travetto/${name}`;
          this.devCache[name] = FsUtil.existsSync(base) ? base : `${pre}/${name}`;
        }
        return `${this.devCache[name]}${rest ? `/${rest}` : ''}`;
      })
        .replace(/\/\/+/g, '/'); // De-dupe
    }
    return pth;
  }
}