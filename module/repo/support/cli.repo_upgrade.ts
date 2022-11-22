import { Packages } from './bin/packages';
import { Repo, RepoModule } from './bin/repo';
import { DEP_GROUPS } from './bin/types';
import { MutatingRepoCommand } from './command';

function logChanges(mod: RepoModule, changes: string[]): [mod: RepoModule, message: string] | undefined {
  if (changes.length) {
    return [mod, `${mod.rel} updated ${changes.length} dependencies - ${changes.join(', ') || 'None'}`];
  } else {
    return undefined;
  }
}

/**
* `npx trv repo:upgrade`
*
* Upgrades all ranged dependencies
*/
export class RepoUpgradeCommand extends MutatingRepoCommand {

  name = 'repo:upgrade';

  async action(...args: unknown[]): Promise<void> {
    const pending: ([mod: RepoModule, message: string] | undefined)[] = [];
    const root = await Repo.root;

    pending.push(await
      Packages.upgrade(root, ['dependencies']).then(logChanges.bind(null, root))
    );

    for (const mod of await Repo.modules) {
      pending.push(await Packages.upgrade(mod, DEP_GROUPS).then(logChanges.bind(null, mod)));
    }

    const results = (await Promise.all(pending)).filter((x): x is Exclude<typeof x, undefined> => !!x);
    for (const [mod, msg] of results) {
      if (!this.cmd.dryRun) {
        await Repo.writePackageJson(mod);
        console.log!(msg);
      } else {
        console.log!(`[DRY-RUN] ${msg}`);
      }
    }
  }
}