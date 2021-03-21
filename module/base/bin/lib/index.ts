import * as fs from 'fs';

import { CliUtil } from '@travetto/cli/src/util';
import { AppCache, FsUtil, FileCache, ExecUtil, EnvUtil } from '@travetto/boot/src';
import { SourceIndex } from '@travetto/boot/src/internal/source';

/**
 * Utilities for running compilation
 */
export class BuildUtil {

  /**
   * Trigger a compile
   */
  static async build(env?: Record<string, string>) {
    if (EnvUtil.isReadonly()) {
      return; // Do not run the compiler
    }

    const output = env?.TRV_CACHE ?? '';
    AppCache.init();

    const { AppManifest } = await import('@travetto/base/src/manifest');

    let missing = false;
    for (const entry of SourceIndex.findByFolders(AppManifest.source)) {
      if (!FsUtil.existsSync(entry.file) || FileCache.isOlder(AppCache.statEntry(entry.file), fs.statSync(entry.file))) {
        missing = true;
        break;
      }
    }

    if (!missing) {
      return;
    }

    // Compile rest of code
    return CliUtil.waiting(`Building... ${output}`,
      ExecUtil.workerMain(require.resolve('../build'), [], { // target self
        env: {
          ...(output ? { TRV_CACHE: output } : {}),
          TRV_WATCH: '0', // Ensure no watching
          ...(env ?? {})
        },
        stderr: false
      }).result
    );
  }
}