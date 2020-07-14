// @ts-ignore
import * as Mod from 'module';

import { FsUtil } from './fs';
import { ScanFs } from './scan';
import { EnvUtil } from './env';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): any;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): any;
} & Mod;

const Module = Mod as any as Module;

// Pre installation of resolution rules
const pkg = (() => { try { return require(FsUtil.resolveUnix('package.json')); } catch { return {}; } })();

/**
 * Framework specific utilities
 */
export class FrameworkUtil {

  private static readonly devCache = {
    boot: FsUtil.resolveUnix(__dirname, '..'),
    [(pkg.name || '').split('/')[1]]: FsUtil.cwd // Initial
  };

  /**
   * Only called in Framework dev mode
   * @param pth The full path to translate
   * @param mod The module to check against
   */
  static resolveDev(p: string, mod?: Module) {
    let pth = p;
    if (mod) {
      try {
        pth = Module._resolveFilename!(pth, mod);
      } catch{ }
    }

    pth = FsUtil.toUnix(pth);

    if (/travetto[^/]*\/module\/[^/]+\/bin/.test(pth) && !pth.startsWith(FsUtil.cwd)) { // Convert bin from framework module
      pth = `${FsUtil.cwd}/node_modules/@travetto/${pth.split(/\/module\//)[1]}`;
    }

    // If relative or framework
    if (pth.includes('@travetto')) {
      // Fetch current module's name
      // Handle self references
      pth = pth.replace(/^(.*\/?@travetto)\/([^/]+)(\/[^@]*)?$/g, (all, pre, name, rest) => {
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

  /**
   * Standard path resolver
   */
  // eslint-disable-next-line @typescript-eslint/member-ordering
  static resolvePath = EnvUtil.isTrue('TRV_DEV') ?
    (a: string, b?: any) => FrameworkUtil.resolveDev(a, b) :
    (x: string) => x;

  /**
  * Scan the framework for folder/files only the framework should care about
  * @param testFile The test to determine if a file is desired
  */
  static scan(testFile?: (x: string) => boolean, base = FsUtil.cwd) {
    const matcher = new RegExp(`^node_modules\/(@travetto|${EnvUtil.getExtModules('!').map(x => x.replace(/\/.*$/, a => `(\\${a})?`)).join('|')})`);
    const out = ScanFs.scanDirSync({
      testFile,
      testDir: x => // Ensure its a valid folder or module folder
        /^node_modules[/]?$/.test(x) ||  // Top level node_modules
        (matcher.test(x) && !/node_modules.*node_modules/.test(x)) || // Module file
        !x.includes('node_modules'), // non module file
      resolvePath: this.resolvePath
    }, base);

    return out;
  }
}