import { CliCommand, CliModuleUtil } from '@travetto/cli';
/**
 * `npx trv repo:changed`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoChangedCommand extends CliCommand {

  name = 'repo:changed';

  async action(...args: unknown[]): Promise<void> {
    for (const mod of await CliModuleUtil.findModules('changed')) {
      console.log!(mod.workspaceRelative);
    }
  }
}