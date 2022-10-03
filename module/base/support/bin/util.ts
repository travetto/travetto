import { statSync } from 'fs';

import { TranspileCache } from '@travetto/boot/src/internal/transpile-cache';
import { CliUtil, EnvUtil, ExecUtil, FsUtil } from '@travetto/boot';
import { SimpleEntry, SourceIndex } from '@travetto/boot/src/internal/source';

/**
 * Utilities for running compilation
 */
export class BuildUtil {

  /**
   * Trigger a compile
   */
  static async build(env?: Record<string, string | undefined>): Promise<number | undefined> {
    if (EnvUtil.isCompiled()) {
      return; // Do not run the compiler
    }

    const output = env?.TRV_CACHE ?? '';
    TranspileCache.init();

    const { AppManifest } = await import('@travetto/base/src/manifest');

    let expired: SimpleEntry | undefined;
    let missing: SimpleEntry | undefined;
    for (const entry of SourceIndex.findByFolders(AppManifest.source)) {
      try {
        if (FsUtil.isOlder(TranspileCache.statEntry(entry.file), statSync(entry.file))) {
          expired = entry;
          break;
        }
      } catch {
        missing = entry;
        break;
      }
    }

    if (!missing && !expired) {
      return;
    }

    // Compile rest of code
    return CliUtil.waiting(`Building... ${output}`,
      ExecUtil.workerMain(require.resolve('../main.build'), [], { // target self
        env: {
          ...(output ? { TRV_CACHE: output } : {}),
          ...(env ?? {})
        },
        stderr: false
      }).result
    );
  }
}