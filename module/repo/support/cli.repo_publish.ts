import { CliCommandShape, CliCommand } from '@travetto/cli';
import { RuntimeIndex } from '@travetto/manifest';

import { PackageManager } from './bin/package-manager';
import { RepoExecUtil } from './bin/exec';

/**
 * Publish all pending modules
 */
@CliCommand()
export class RepoPublishCommand implements CliCommandShape {

  /** Dry Run? */
  dryRun = true;

  async main(): Promise<void> {
    const published = await RepoExecUtil.execOnModules('all', (mod, opts) => PackageManager.isPublished(RuntimeIndex.manifest, mod, opts), {
      filter: mod => !!mod.local && !mod.internal,
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`,
      showStderr: false,
      transformResult: (mod, res) => PackageManager.validatePublishedResult(RuntimeIndex.manifest, mod, res),
    });

    if (this.dryRun) {
      console.log('Unpublished modules', [...published.entries()].filter(x => !x[1]).map(([mod]) => mod.sourceFolder));
    }

    await RepoExecUtil.execOnModules(
      'all', (mod, opts) => PackageManager.publish(RuntimeIndex.manifest, mod, this.dryRun, opts),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        showStdout: false,
        filter: mod => published.get(mod) === false
      }
    );
  }
}