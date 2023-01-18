import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';

type Options = {
  changed: OptionConfig<boolean>;
};

/**
 * Command line support for linting
 */
export class LintCommand extends CliCommand<Options> {
  name = 'lint';

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only check changed modules', def: true }),
    };
  }

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async action(): Promise<void> {
    const mods = await CliModuleUtil.findModules(this.cmd.changed ? 'changed' : 'all');

    const res = await ExecUtil.spawn('npx', ['eslint', '--ext', '.js,.ts', ...mods.map(x => x.source)], {
      cwd: RootIndex.manifest.workspacePath,
      stdio: 'inherit'
    }).result.catchAsResult();

    return this.exit(res.code);
  }
}