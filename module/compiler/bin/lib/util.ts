import * as fs from 'fs';
import { CliUtil } from '@travetto/cli/src/util';

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

  static async compile() {
    const { AppCache } = await import(`@travetto/boot`);

    //  Compile
    await CliUtil.fork(`${__dirname}/compile-target.js`, [], process.env);
  }
}