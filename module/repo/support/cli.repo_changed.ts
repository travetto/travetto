
import { CliCommand } from '@travetto/cli';
import { Git } from './bin/git';

type Options = {};

/**
 * `npx trv repo:changed`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoChangedCommand extends CliCommand<Options> {

  name = 'repo:changed';

  async action(...args: unknown[]): Promise<void> {
    for (const mod of await Git.findChangedModules()) {
      console.log(mod.folder);
    }
  }
}