// @ts-ignore
import * as Mod from 'module';

import { FsUtil } from './fs';
import { ScanFs } from './scan';
import { EnvUtil } from './env';

type Module = {
  loaded?: boolean;
  _load?(req: string, parent: Module): unknown;
  _resolveFilename?(req: string, parent: Module): string;
  _compile?(contents: string, file: string): unknown;
} & NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-redeclare
const Module = Mod as unknown as Module;

/**
 * Framework specific utilities
 */
export class FrameworkUtil {

  /**
   * Scan the framework for folder/files only the framework should care about
   * @param testFile The test to determine if a file is desired
   */
  static scan(testFile?: (x: string) => boolean, base = FsUtil.cwd) {
    const out = [ScanFs.scanDirSync({
      testFile,
      testDir: x => // Ensure its a valid folder or module folder
        /^node_modules[/]?$/.test(x) ||  // Top level node_modules
        (/^node_modules\/@travetto/.test(x) && !/node_modules.*node_modules/.test(x)) || // Module file
        !x.includes('node_modules') // non module file
    }, base)];

    // Load dynamic modules with mappings
    for (const [dep, pth] of Object.entries(EnvUtil.getDynamicModules())) {
      out.push(
        ScanFs.scanDirSync({
          testFile,
          testDir: x => !x.includes('node_modules'),
        }, pth)
          .map(d => {
            d.module = d.module.includes('node_modules') ?
              d.module : d.file.replace(pth, `node_modules/${dep}`);
            return d;
          })
      ); // Read from module
    }

    return out.flat();
  }
}