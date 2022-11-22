import { CliCommand } from '@travetto/cli';

import { Npm } from './bin/npm';

/**
 * `npx trv repo:clean`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoCleanCommand extends CliCommand {

  name = 'repo:clean';

  async action(...args: unknown[]): Promise<void> {
    await Npm.exec('trv', ['clean']);
  }
}