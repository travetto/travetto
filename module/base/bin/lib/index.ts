import { ExecUtil } from '@travetto/boot/src/exec';
import { EnvUtil } from '@travetto/boot/src/env';
import { CliUtil } from '@travetto/cli/src/util';

/**
 * Utilities for running compilation
 */
export class BuildUtil {

  /**
   * Trigger a compile
   */
  static build(env?: Record<string, string>) {
    if (EnvUtil.isReadonly()) {
      return; // Do not run the compiler
    }

    const output = env?.TRV_CACHE ?? '';

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