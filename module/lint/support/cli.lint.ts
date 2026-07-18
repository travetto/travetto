import { spawn } from 'node:child_process';
import { CliCommand, type CliCommandShape, CliModuleUtil, CliParseUtil } from '@travetto/cli';
import { Env, ExecUtil, Runtime } from '@travetto/runtime';

/**
 * Run Biome linter/formatter for the workspace or changed files.
 *
 * Supports incremental mode (`changed`/`since`) and forwards format/fix
 * options to the underlying biome invocation.
 */
@CliCommand()
export class LintCommand implements CliCommandShape {
  /** Only check changed modules */
  changed = false;

  /** Since a specific git commit */
  since?: string;

  /** Should we attempt to fix/write formatting changes? */
  fix?: boolean;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const paths = await CliModuleUtil.findChangedPaths({ changed: this.changed, since: this.since, logError: true });

    if ((this.changed || this.since) && paths.length === 0) {
      console.log('No changed files found to lint.');
      return;
    }

    const state = CliParseUtil.getState(this);
    const result = await ExecUtil.getResult(
      spawn(
        process.argv0,
        [
          Runtime.workspaceRelative('node_modules', '.bin', 'biome'),
          'check',
          ...(this.fix ? ['--write'] : []),
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
