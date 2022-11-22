
import { CliCommand } from '@travetto/cli';
import { Git } from './bin/git';

/**
 * `npx trv repo:changed`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoChangedCommand extends CliCommand {

  name = 'repo:changed';

  async action(...args: unknown[]): Promise<void> {
    for (const mod of await Git.findChangedModulesRecursive()) {
      console.log!(mod.rel);
    }
  }
}