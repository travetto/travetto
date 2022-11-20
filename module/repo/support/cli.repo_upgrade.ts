import * as fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { CliCommand } from '@travetto/cli';

import { Packages } from './bin/packages';
import { Repo, RepoModule } from './bin/repo';
import { DEP_GROUPS } from './bin/types';

type Options = {};

function logChanges(mod: RepoModule, changes: string[]): [mod: RepoModule, message: string] | undefined {
  if (changes.length) {
    return [mod, `${mod.folder} updated ${changes.length} dependencies - ${changes.join(', ') || 'None'}`];
  } else {
    return undefined;
  }
}

/**
* `npx trv repo:upgrade`
*
* Upgrades all ranged dependencies
*/
export class RepoUpgradeCommand extends CliCommand<Options> {

  name = 'repo:upgrade';

  async action(...args: unknown[]): Promise<void> {
    const pending: Promise<[mod: RepoModule, message: string] | undefined>[] = [];
    const rootFolder = await Repo.repoRoot;
    const rootMod = { folder: '.', pkg: await Repo.getRepoPackage() };

    pending.push(
      Packages.upgrade(rootMod, ['dependencies']).then(logChanges.bind(null, rootMod))
    );

    for (const mod of await Repo.modules) {
      pending.push(Packages.upgrade(mod, DEP_GROUPS).then(logChanges.bind(null, mod)));
    }

    const results = (await Promise.all(pending)).filter((x): x is Exclude<typeof x, undefined> => !!x);
    for (const [mod, msg] of results) {
      await fs.writeFile(path.resolve(rootFolder, mod.folder, 'package.json'), JSON.stringify(mod.pkg, null, 2), 'utf8');
      console.log(msg);
    }
  }
}