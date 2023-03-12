import { BaseCliCommand, CliCommand, CliModuleUtil } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

import { PackageManager } from './bin/package-manager';

/**
* `npx trv repo:publish`
*
* Publish all pending modules
*/
@CliCommand()
export class RepoPublishCommand implements BaseCliCommand {

  /** Dry Run? */
  dryRun = true;

  async action(...args: unknown[]): Promise<void> {
    const published = await CliModuleUtil.execOnModules('all', (mod, opts) => PackageManager.isPublished(RootIndex.manifest, mod, opts), {
      filter: mod => !!mod.local && !mod.internal,
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`,
      showStderr: false,
      transformResult: (mod, res) => PackageManager.validatePublishedResult(RootIndex.manifest, mod, res),
    });

    if (this.dryRun) {
      console.log('Unpublished modules', [...published.entries()].filter(x => !x[1]).map(([mod]) => mod.sourceFolder));
    }

    await CliModuleUtil.execOnModules(
      'all', (mod, opts) => PackageManager.publish(RootIndex.manifest, mod, this.dryRun, opts),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        showStdout: false,
        filter: mod => published.get(mod) === false
      }
    );
  }
}