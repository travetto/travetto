import * as fs from 'fs';
import { ExecUtil } from '@travetto/boot';
import { CliUtil } from '@travetto/cli/src/util';

export class CompileCliUtil {
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

  /**
   * Trigger a compile
   */
  static compile(output?: string) {
    return CliUtil.waiting('Compiling...',
      ExecUtil.worker('@travetto/compiler/bin/plugin-compile', [], {
        env: output ? { TRV_CACHE: output } : {},
        stderr: false
      }).result
    );
  }
}