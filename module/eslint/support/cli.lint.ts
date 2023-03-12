import { RootIndex } from '@travetto/manifest';
import { ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { BaseCliCommand, CliCommand, CliModuleUtil } from '@travetto/cli';

/**
 * Command line support for linting
 */
@CliCommand()
export class LintCommand implements BaseCliCommand {

  /** Only check changed modules */
  changed = false;

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async action(): Promise<number> {
    const mods = await CliModuleUtil.findModules(this.changed ? 'changed' : 'all');

    const res = await ExecUtil.spawn('npx', ['eslint', ...mods.filter(x => x.local).map(x => x.sourcePath)], {
      cwd: RootIndex.manifest.workspacePath,
      stdio: 'inherit',
      catchAsResult: true
    }).result;

    return res.code;
  }
}