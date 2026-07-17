import { spawn } from 'node:child_process';

import { Env, ExecUtil, Runtime } from '@travetto/runtime';
import { CliCommand, type CliCommandShape, CliModuleUtil } from '@travetto/cli';

/**
 * Run Oxlint safety checking for the workspace or changed files.
 *
 * Supports incremental mode (changed/since) and forwards options to the
 * underlying oxlint invocation.
 */
@CliCommand()
export class LintCheckCommand implements CliCommandShape {

  /** Only check changed modules */
  changed = false;

  /** Output format */
  format?: string;

  /** Since a specific git commit */
  since?: string;

  /** Should we attempt to fix? */
  fix?: boolean;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const paths = await CliModuleUtil.findChangedPaths({ changed: this.changed, since: this.since, logError: true });

    if (paths.length === 0 && (this.changed || this.since)) {
      console.log('No changed files found to lint.');
      return;
    }

    const commandArguments: string[] = [
      Runtime.workspaceRelative('node_modules', '.bin', 'oxlint'),
      ...(this.format ? ['--format', this.format] : []),
      ...(this.fix ? ['--fix'] : []),
      ...paths
    ];

    const linterResult = await ExecUtil.getResult(spawn(process.argv0, commandArguments, {
      cwd: Runtime.workspace.path,
      stdio: 'inherit',
    }), { catch: true });

    process.exitCode = linterResult.code;
  }
}
