import * as fs from 'fs';

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
}