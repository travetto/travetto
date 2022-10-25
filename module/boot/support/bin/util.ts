import { statSync } from 'fs';

import { CliUtil, ExecUtil, FsUtil, PathUtil } from '@travetto/boot';
import { ModuleIndex } from '@travetto/manifest';

/**
 * Utilities for running compilation
 */
export class BuildUtil {

  static async needsBuild(outputFolder: string): Promise<boolean> {
    for (const entry of ModuleIndex.findSrc({})) {
      try {
        if (FsUtil.isOlder(statSync(entry.source), statSync(PathUtil.resolveUnix(outputFolder, entry.file)))) {
          return true;
        }
      } catch {
        return true;
      }
    }

    return false;
  }

  /**
   * Trigger a compile
   */
  static async build(outputFolder: string = '.trv_out', compilerDir: string = '.trv_compiler', env?: Record<string, string | undefined>): Promise<number | undefined> {
    if (!(await this.needsBuild(outputFolder))) {
      return;
    }

    // Compile rest of code
    return CliUtil.waiting(`Building... ${outputFolder}`,
      ExecUtil.worker(compilerDir, [], {
        env: {
          ...(outputFolder ? { TRV_CACHE: outputFolder } : {}),
          ...(env ?? {})
        },
        stderr: false
      }).result
    );
  }
}