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
  static compile(output?: string, env?: Record<string, string>) {
    if (EnvUtil.isReadonly()) {
      return; // Do not run the compiler
    }

    // Compile rest of code
    return CliUtil.waiting(`Compiling... ${output || ''}`,
      ExecUtil.workerEntry(__filename, [], { // target self
        env: {
          ...(output ? { TRV_CACHE: output } : {}),
          TRV_WATCH: '0', // Ensure no watching
          ...(env ?? {})
        },
        stderr: false
      }).result
    );
  }

  /**
   * Compile All
   */
  static async compileAll() {
    const { PhaseManager } = await import('@travetto/base');
    // Standard compile
    await PhaseManager.run('init', '@trv:compiler/compile');
  }
}

export function main() {
  return CompileCliUtil.compileAll();
}