import { statSync } from 'fs';

import { CliUtil, EnvUtil, FsUtil } from '@travetto/boot';
import { ModuleIndexEntry, ModuleIndex } from '@travetto/boot/src/internal/module';
import { ModuleExec } from '@travetto/boot/src/internal/module-exec';

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

    let expired: ModuleIndexEntry | undefined;
    let missing: ModuleIndexEntry | undefined;
    for (const entry of ModuleIndex.findSrc({})) {
      try {
        if (FsUtil.isOlder(statSync(entry.source), statSync(entry.file))) {
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
      ModuleExec.workerMain(require.resolve('../main.build'), [], { // target self
        env: {
          ...(output ? { TRV_CACHE: output } : {}),
          ...(env ?? {})
        },
        stderr: false
      }).result
    );
  }
}