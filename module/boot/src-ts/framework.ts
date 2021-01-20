import { EnvUtil } from './env';
import { FsUtil } from './fs';
import { ScanEntry, ScanFs } from './scan';

const isStandardDir = (x: string) =>
  /^node_modules[/]?$/.test(x) ||  // Top level node_modules
  (/^node_modules\/@travetto/.test(x) && !/node_modules.*node_modules/.test(x)) || // Module file
  !x.includes('node_modules'); // non module file
const isModuleDir = (x: string) => !x.includes('node_modules');
const processModule = (dep: string, pth: string, e: ScanEntry) => {
  e.module = e.module.includes('node_modules') ? e.module : e.file.replace(pth, `node_modules/${dep}`);
  return e;
};

export type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };

/**
 * Framework specific utilities
 */
export class FrameworkUtil {
  /**
   * Scan the framework for folder/files only the framework should care about
   * @param testFile The test to determine if a file is desired
   */
  static scan(test: ScanTest) {
    const cleaned = 'test' in test ? test.test.bind(test) : test;

    // Folders to check
    const folders = [
      { testFile: cleaned, testDir: isStandardDir, base: FsUtil.cwd, map: (e: ScanEntry) => e },
      ...Object.entries(EnvUtil.getDynamicModules()).map(([dep, pth]) => (
        { testFile: cleaned, testDir: isModuleDir, base: pth, map: (e: ScanEntry) => processModule(dep, pth, e) }
      ))
    ];
    const out: ScanEntry[][] = [];
    for (const { testFile, testDir, base, map } of folders) {
      out.push(ScanFs.scanDirSync({ testFile, testDir }, base).map(map).filter(x => x.stats.isFile()));
    }

    return out.flat();
  }
}