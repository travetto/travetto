import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { BaseCliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';

type Options = {
  changed: OptionConfig<boolean>;
};

/**
 * Command line support for linting
 */
export class LintCommand extends BaseCliCommand<Options> {
  name = 'lint';

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only check changed modules', def: false }),
    };
  }

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async action(): Promise<void> {
    const mods = await CliModuleUtil.findModules(this.cmd.changed ? 'changed' : 'all');

    const res = await ExecUtil.spawn('npx', ['eslint', ...mods.filter(x => x.local).map(x => x.sourcePath)], {
      cwd: RootIndex.manifest.workspacePath,
      stdio: 'inherit',
      catchAsResult: true
    }).result;

    return this.exit(res.code);
  }
}