import { RuntimeContext } from '@travetto/manifest';
import { Env, ExecUtil } from '@travetto/base';
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

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    let files: string[];
    if (this.since) {
      files = (await CliScmUtil.findChangedFiles(this.since))
        .filter(x => !x.endsWith('package.json') && !x.endsWith('package-lock.json'));
    } else {
      const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all');
      files = mods.filter(x => x.local).map(x => x.sourcePath);
    }


    const res = await ExecUtil.spawn('npx', [
      'eslint',
      ...(this.format ? ['--format', this.format] : []),
      ...files
    ], {
      cwd: RuntimeContext.workspace.path,
      stdio: 'inherit',
      catchAsResult: true
    }).result;

    process.exitCode = res.code;
  }
}