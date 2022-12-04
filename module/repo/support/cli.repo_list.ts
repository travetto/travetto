import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';

type Options = {
  changed: OptionConfig<boolean>;
};

/**
 * `npx trv repo:list`
 *
 * Allows for listing of modules
 */
export class RepoListCommand extends CliCommand<Options> {

  name = 'repo:list';

  getOptions(): Options {
    return { changed: this.boolOption({ desc: 'Only show changed modules', def: false }) };
  }

  async action(...args: unknown[]): Promise<void> {
    for (const mod of await CliModuleUtil.findModules(this.cmd.changed ? 'changed' : 'all')) {
      console.log!(mod.workspaceRelative);
    }
  }
}