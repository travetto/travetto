import { spawn } from 'node:child_process';

import { Env, ExecUtil, Runtime } from '@travetto/runtime';
import { CliCommandShape, CliCommand, CliModuleUtil, CliScmUtil } from '@travetto/cli';

/**
 * Command line support for linting
 */
@CliCommand()
export class LintCommand implements CliCommandShape {

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
    let files: string[];
    try {
      if (this.since) {
        files = (await CliScmUtil.findChangedFiles(this.since, 'HEAD'))
          .filter(x => !x.endsWith('package.json') && !x.endsWith('package-lock.json'));
      } else {
        const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'workspace', undefined, 'HEAD');
        files = mods.map(x => x.sourcePath);
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }
      files = [];
    }

    const result = await ExecUtil.getResult(spawn('npx', [
      'eslint',
      '--cache',
      '--cache-location', Runtime.toolPath('.eslintcache'),
      ...(this.format ? ['--format', this.format] : []),
      ...(this.fix ? ['--fix'] : []),
      ...files
    ], {
      cwd: Runtime.workspace.path,
      stdio: 'inherit',
    }), { catch: true });

    process.exitCode = result.code;
  }
}