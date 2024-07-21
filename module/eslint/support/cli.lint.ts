import { spawn } from 'node:child_process';

import { Env, ExecUtil, Runtime } from '@travetto/base';
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
    if (this.since) {
      files = (await CliScmUtil.findChangedFiles(this.since, 'HEAD', true))
        .filter(x => !x.endsWith('package.json') && !x.endsWith('package-lock.json'));
    } else {
      const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all', undefined, 'HEAD', true);
      files = mods.filter(x => x.workspace).map(x => x.sourcePath);
    }

    const res = await ExecUtil.getResult(spawn('npx', [
      'eslint',
      '--cache',
      '--cache-location', Runtime.context.toolPath('.eslintcache'),
      ...(this.format ? ['--format', this.format] : []),
      ...(this.fix ? ['--fix'] : []),
      ...files
    ], {
      cwd: Runtime.context.workspace.path,
      stdio: 'inherit',
      shell: false
    }), { catch: true });

    process.exitCode = res.code;
  }
}