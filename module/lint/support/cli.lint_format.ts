import { spawn } from 'node:child_process';

import { CliCommand, type CliCommandShape, CliFlag, CliModuleUtil, CliParseUtil } from '@travetto/cli';
import { Env, ExecUtil, Runtime } from '@travetto/runtime';

/**
 * Run oxfmt formatter for the workspace or changed files.
 *
 * Formats files in place by default. Use `--check` for read-only verification.
 */
@CliCommand()
export class LintFormatCommand implements CliCommandShape {
  /** Only format changed modules */
  changed = false;

  /** Since a specific git commit */
  since?: string;

  /** Report formatting violations without writing changes */
  @CliFlag({ short: 'c' })
  check = false;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const paths = await CliModuleUtil.findChangedPaths({ changed: this.changed, since: this.since, logError: true });

    if ((this.changed || this.since) && paths.length === 0) {
      console.log('No changed files found to format.');
      return;
    }

    const state = CliParseUtil.getState(this);
    const result = await ExecUtil.getResult(
      spawn(
        process.argv0,
        [
          Runtime.workspaceRelative('node_modules', '.bin', 'oxfmt'),
          ...(this.check ? ['--check'] : ['--write']),
          ...paths,
          ...(state?.unknown ?? [])
        ],
        {
          stdio: 'inherit'
        }
      ),
      { catch: true }
    );

    process.exitCode = result.code;
  }
}
