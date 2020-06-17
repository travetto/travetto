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
        env: {
          ...(output ? { TRV_CACHE: output } : {}),
          TRV_WATCH: '0' // Ensure no watching
        },
        stderr: false
      }).result
    );
  }

  /**
   * Compile CLI
   */
  static async compileCli() {
    const { ScanApp } = await import('@travetto/base');
    const { AppCache } = await import('@travetto/boot');

    // Compile @travetto/cli directly
    for (const x of ScanApp.findFiles({ folder: 'src', paths: ['@travetto/cli'] })) {
      if (!AppCache.hasEntry(x.file)) {
        require(x.file); // Transpile all the desired files
      }
    }

    for (const x of ScanApp.findFiles({ folder: 'bin' })) {
      if (!AppCache.hasEntry(x.file)) {
        require(x.file); // Transpile all the desired files
      }
    }
  }
}