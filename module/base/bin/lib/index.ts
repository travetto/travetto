import * as fs from 'fs';

import { CliUtil } from '@travetto/cli/src/util';
import { AppCache, FileCache, ExecUtil, EnvUtil } from '@travetto/boot';
import { SimpleEntry, SourceIndex } from '@travetto/boot/src/internal/source';

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

    let expired: SimpleEntry | undefined;
    let missing: SimpleEntry | undefined;
    for (const entry of SourceIndex.findByFolders(AppManifest.source)) {
      try {
        if (FileCache.isOlder(AppCache.statEntry(entry.file), fs.statSync(entry.file))) {
          expired = entry;
          break;
        }
      } catch (e) {
        missing = entry;
        break;
      }
    }

    if (!missing && !expired) {
      return;
    }

    // Compile rest of code
    return CliUtil.waiting(`Building... ${output}`,
      ExecUtil.workerMain(require.resolve('../build'), [], { // target self
        env: {
          ...(output ? { TRV_CACHE: output } : {}),
          ...(env ?? {})
        },
        stderr: false
      }).result
    );
  }
}