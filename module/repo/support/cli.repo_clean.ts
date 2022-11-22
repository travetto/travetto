import * as fs from 'fs/promises';

import { path } from '@travetto/manifest';

import { Repo } from './bin/repo';
import { MutatingRepoCommand } from './command';

/**
 * `npx trv repo:clean`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoCleanCommand extends MutatingRepoCommand {

  name = 'repo:clean';

  async action(...args: unknown[]): Promise<void> {
    const removing: Promise<void>[] = [];
    for (const mod of await Repo.modules) {
      for (const folder of await fs.readdir(mod.full)) {
        if (folder.startsWith('.trv_')) {
          if (!this.cmd.dryRun) {
            removing.push(fs.rm(path.resolve(mod.full, folder), { recursive: true, force: true }).then(() => {
              console.log!(`Successfully cleaned ${mod.rel}/${folder}`);
            }));
          } else {
            console.log!(`[DRY-RUN] Successfully cleaned ${mod.rel}/${folder}`);
          }
        }
      }
    }
    await Promise.all(removing);
  }
}