import { spawn } from 'node:child_process';

import { CliCommand, type CliCommandShape, CliModuleUtil, CliParseUtil } from '@travetto/cli';
import { Env, ExecUtil, Runtime } from '@travetto/runtime';

/**
 * Run cspell spell checker for the workspace or changed files.
 *
 * Supports incremental mode (`changed`/`since`) and forwards options
 * to the underlying cspell invocation.
 */
@CliCommand()
export class LintSpellCommand implements CliCommandShape {
  /** Only check changed modules */
  changed = false;

  /** Since a specific git commit */
  since?: string;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const paths = await CliModuleUtil.findChangedPaths({ changed: this.changed, since: this.since, logError: true });

    if ((this.changed || this.since) && paths.length === 0) {
      console.log('No changed files found to check.');
      return;
    }

    const state = CliParseUtil.getState(this);
    const targetPaths = paths.length > 0 ? paths : ['.'];
    const result = await ExecUtil.getResult(
      spawn(
        'npx',
        ['cspell', 'lint', ...targetPaths, ...(state?.unknown ?? [])],
        {
          stdio: 'inherit'
        }
      ),
      { catch: true }
    );

    process.exitCode = result.code;
  }
}
