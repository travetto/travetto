import { CliCommand } from '@travetto/cli';

import { RepoWorker } from './bin/work';

/**
 * `npx trv repo:clean`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoCleanCommand extends CliCommand {

  name = 'repo:clean';

  async action(...args: unknown[]): Promise<void> {
    await RepoWorker.exec(
      folder => RepoWorker.forCommand(folder, 'trv', ['clean'], 'inherit'),
      {
        mode: 'all',
        workers: 100
      }
    );
  }
}