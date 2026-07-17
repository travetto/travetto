import { spawn } from 'node:child_process';

import { Env, ExecUtil, Runtime } from '@travetto/runtime';
import { CliCommand, type CliCommandShape, CliModuleUtil } from '@travetto/cli';

/**
 * Run Oxfmt code style formatting for the workspace or changed files.
 *
 * Supports incremental mode (changed/since) and checking mode.
 */
@CliCommand()
export class LintFormatCommand implements CliCommandShape {

  /** Only check changed modules */
  changed = false;

  /** Since a specific git commit */
  since?: string;

  /** Only check formatting, do not write in-place */
  check = false;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const paths = await CliModuleUtil.findChangedPaths({ changed: this.changed, since: this.since, logError: true });

    if (paths.length === 0 && (this.changed || this.since)) {
      console.log('No changed files found to format.');
      return;
    }

    const commandArguments: string[] = [
      Runtime.workspaceRelative('node_modules', '.bin', 'oxfmt'),
      ...(this.check ? ['--check'] : []),
      ...paths
    ];

    const formatterResult = await ExecUtil.getResult(spawn(process.argv0, commandArguments, {
      cwd: Runtime.workspace.path,
      stdio: 'inherit',
    }), { catch: true });

    process.exitCode = formatterResult.code;
  }
}
