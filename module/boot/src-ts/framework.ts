// @ts-ignore
import * as Mod from 'module';
import * as path from 'path';

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

const isDev = EnvUtil.isTrue('TRV_DEV');

/**
 * Framework specific utilities
 */
export class FrameworkUtil {

  private static readonly devCache = {
    boot: FsUtil.toUnix(path.resolve(__dirname, '..')),
    [require(FsUtil.joinUnix(FsUtil.cwd, 'package.json')).name.split('/')[1]]: FsUtil.cwd // Initial
  };

  /**
   * Are we in dev mode?
   */
  static readonly devMode = isDev;

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

    if (/travetto[^/]*\/module\/[^/]+\/bin/.test(pth)) { // Convert bin from framework module
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
  static resolvePath = isDev ? (a: string, b?: any) => FrameworkUtil.resolveDev(a, b) : (x: string) => x;

  /**
  * Scan the framework for folder/files only the framework should care about
  * @param testFile The test to determine if a file is desired
  */
  static scan(testFile?: (x: string) => boolean, base = FsUtil.cwd) {
    const out = ScanFs.scanDirSync({
      testFile,
      testDir: x => // Ensure its a valid folder or module folder
        !/node_modules[/][^@]/.test(x) && (  // Excluding non framework node modules
          !x.includes('node_modules') || // All non-framework folders
          x.endsWith('node_modules') || // Is first level node_modules
          x.includes('@travetto')  // Is framework folder, include everything under it
        ),
      resolvePath: this.resolvePath
    }, base);

    return out;
  }
}