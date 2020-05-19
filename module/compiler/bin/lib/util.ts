import * as fs from 'fs';
import { ExecUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

export class CompileUtil {
  /**
   * Rewrite the cache directory to allow for packaging
   */
  static async rewriteRuntimeDir(runtimeDir: string = process.cwd()) {
    const { FsUtil, AppCache } = await import(`@travetto/boot`);

    const files = fs.readdirSync(AppCache.cacheDir).map(x => FsUtil.resolveUnix(AppCache.cacheDir, x));

    for (const file of files) {
      const contents = fs.readFileSync(file, 'utf-8')
        .replace(/[/][/]#.*$/, '') // Drop source maps
        .replace(new RegExp(FsUtil.cwd, 'g'), runtimeDir); // Rewrite paths
      fs.writeFileSync(file, contents, 'utf-8');
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