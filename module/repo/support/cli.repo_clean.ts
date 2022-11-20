import * as fs from 'fs/promises';

import { CliCommand } from '@travetto/cli';
import { path } from '@travetto/manifest';

import { Repo } from './bin/repo';

type Options = {};

/**
 * `npx trv repo:clean`
 *
 * Allows for cleaning of the compiler output
 */
export class RepoCleanCommand extends CliCommand<Options> {

  name = 'repo:clean';

  async action(...args: unknown[]): Promise<void> {
    const removing: Promise<void>[] = [];
    for (const mod of await Repo.modules) {
      for (const folder of await fs.readdir(mod.folder)) {
        if (folder.startsWith('.trv_')) {
          removing.push(fs.rm(path.resolve(mod.folder, folder), { recursive: true, force: true }));
        }
      }
    }
    await Promise.all(removing);
  }
}