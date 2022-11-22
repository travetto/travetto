import * as rl from 'readline';

import { Git } from './bin/git';
import { Repo, RepoModule } from './bin/repo';
import { Semver, SemverLevel } from './bin/semver';
import { MutatingRepoCommand } from './command';

const prompt = rl.createInterface({ input: process.stdin, output: process.stdout });

/**
* `npx trv repo:version`
*
* Version all all changed dependencies
*/
export class RepoVersionCommand extends MutatingRepoCommand {

  name = 'repo:version';

  getArgs() {
    return `[level] [prefix?]`;
  }

  async action(level: SemverLevel | 'release', prefix?: string): Promise<void> {
    await Git.checkWorkspaceDirty('Cannot update versions with uncommitted changes');

    const toUpgrade: RepoModule[] = [];

    // Upgrade in-memory, and prepare for writing
    if (level === 'release') {
      if (!prefix) {
        console.error!('You must specify a version to release');
        process.exit(1);
      }
      for (const mod of await Repo.publicModules) {
        if (mod.pkg.version.includes('-')) {
          mod.pkg.version = mod.pkg.version.replace(/-.*$/, '');
          toUpgrade.push(mod);
        }
      }
    } else {
      for (const mod of await Git.findChangedModulesRecursive()) {
        if (mod.public) {
          mod.pkg.version = Semver.incrementInplace(mod.pkg.version, level, prefix);
          toUpgrade.push(mod);
        }
      }
    }

    // Do we have valid changes?
    if (toUpgrade.length) {
      for (const mod of toUpgrade) {
        console.log!(`${this.cmd.dryRun ? '[DRY-RUN] ' : ''}Upgrading ${mod.name} from ${mod.ogPkg.version} to ${mod.pkg.version}`);
      }
      if (!this.cmd.dryRun) {
        const result = await new Promise<string>(res => prompt.question('Continue? ', res));
        if (result !== 'yes') {
          return;
        }
        for (const mod of toUpgrade) {
          await Repo.writePackageJson(mod);
        }
        console.log!(await Git.publishCommit(toUpgrade.map(x => x.name).join(',')));
      }
    }
  }
}