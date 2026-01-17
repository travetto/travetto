import { spawn } from 'node:child_process';

import { Env, ExecUtil, Runtime } from '@travetto/runtime';
import { type CliCommandShape, CliCommand, CliModuleUtil } from '@travetto/cli';

/**
 * Command line support for eslint
 */
@CliCommand()
export class ESLintCommand implements CliCommandShape {

  /** Only check changed modules */
  changed = false;

  /** Output format */
  format?: string;

  /** Since a specific git commit */
  since?: string;

  /** Should we attempt to fix? */
  fix?: boolean;

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const paths = await CliModuleUtil.findChangedPaths({ changed: this.changed, since: this.since, logError: true });

    const result = await ExecUtil.getResult(spawn(process.argv0, [
      Runtime.workspaceRelative('node_modules', '.bin', 'eslint'),
      '--cache',
      '--cache-location', Runtime.toolPath('.eslintcache'),
      ...(this.format ? ['--format', this.format] : []),
      ...(this.fix ? ['--fix'] : []),
      ...paths
    ], {
      cwd: Runtime.workspace.path,
      stdio: 'inherit',
    }), { catch: true });

    process.exitCode = result.code;
  }
}