import * as fs from 'fs';
import { ExecUtil } from '@travetto/boot';
import { CliUtil } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';

export class CompileUtil {
  /**
   * Rewrite the cache directory to allow for packaging
   */
  static async rewriteRuntimeDir(runtimeDir: string = process.cwd()) {
    const { FsUtil, AppCache } = await import(`@travetto/boot`);

    const files = fs.readdirSync(AppCache.cacheDir).map(x => FsUtil.resolveUnix(AppCache.cacheDir, x));

    // Rewrite files to allow for presume different path
    const FILES = `ScanApp.setFileEntries('.ts', [
    ${files.map(x => `'${AppCache.toEntryName(x)}'`).join(',')}
])`;

    for (const file of files) {
      const contents = fs.readFileSync(file, 'utf-8')
        .replace(/ScanApp\.cache =.*/, x => `${x};\n${FILES}`) // Only for scan-app
        .replace(/[/][/]#.*$/, '') // Drop source maps
        .replace(new RegExp(FsUtil.cwd, 'g'), runtimeDir); // Rewrite paths
      fs.writeFileSync(file, contents);
    }
  }

  static async compile(path: string) {
    //  Compile
    try {
      await ExecUtil.fork(`${__dirname}/../compile-target.js`);
    } catch (err) {
      console.error(color`${{ failure: 'Failed' }} to compile to ${{ path }}`, err);
      process.exit(1);
    }
  }
}