import * as fs from 'fs';
import { ExecUtil } from '@travetto/boot/src/exec';
import { EnvUtil } from '@travetto/boot/src/env';
import { CliUtil } from '@travetto/cli/src/util';

/**
 * Utilities for running compilation
 */
export class CompileCliUtil {

  /**
   * Trigger a compile
   */
  static async compile(output?: string) {
    if (EnvUtil.isReadonly()) {
      return; // Do not run the compiler
    }

    // Pre compile cli/bin folders if targetting a different location
    if (output) {
      await ExecUtil.spawn('npx', ['trv'], { env: { TRV_CACHE: output } }).result.catch(() => { });
    }

    // Compile rest of code
    return CliUtil.waiting(`Compiling... ${output || ''}`,
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
   * Compile All
   */
  static async compileAll() {
    const { FsUtil } = await import('@travetto/boot');
    const alt = FsUtil.resolveUnix('alt');
    if (FsUtil.existsSync(alt)) {
      process.env.TRV_ROOTS = fs.readdirSync(alt).map(x => `./alt/${x}`).join(',');
    }

    const { PhaseManager } = await import('@travetto/base');

    // Standard compile
    PhaseManager.init('@trv:compiler/compile');
  }
}