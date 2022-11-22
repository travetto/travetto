import * as fs from 'fs/promises';
import { ExecUtil } from '@travetto/base';

import { Packages } from './bin/packages';
import { Repo } from './bin/repo';
import { MutatingRepoCommand } from './command';

/**
* `npx trv repo:publish`
*
* Publish all pending modules
*/
export class RepoPublishCommand extends MutatingRepoCommand {

  name = 'repo:publish';

  async action(...args: unknown[]): Promise<void> {
    const publishedVersions = (await Repo.publicModules)
      .map(mod =>
        Packages.findPublishedVersion(mod.full, mod.name, mod.pkg.version)
          .then(version => [mod, version] as const)
      );

    for (const [mod, published] of await Promise.all(publishedVersions)) {
      if (!published) {
        continue;
      }

      const tag = mod.pkg.version.replace(/^.*-(rc|latest|alpha|beta|next)[.]\d+/, (a, b) => b) || 'latest';

      if (this.cmd.dryRun) {
        console.log!(`[DRY-RUN] Publishing ${mod.name} with tag ${tag}`);
      } else {
        await fs.copyFile('LICENSE', `${mod.full}/LICENSE`);
        const args = [
          'publish',
          '--tag', tag,
          '--access', 'public'
        ];
        if (!/^[~^]/.test(tag) && !/-(rc|latest|alpha|beta|next)[.]\d+$/.test(mod.pkg.version)) {
          args.push('--tag', 'latest');
        }
        const { result } = ExecUtil.spawn('npm', args, { cwd: mod.full, stdio: [0, 1, 2] });
        await result;
      }
    }
  }
}