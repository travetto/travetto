import { CliCommandShape, CliCommand } from '@travetto/cli';
import { RuntimeContext } from '@travetto/manifest';

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
    const published = await RepoExecUtil.execOnModules('all', mod => PackageManager.isPublished(RuntimeContext, mod), {
      filter: mod => !!mod.local && !mod.internal,
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`,
      showStderr: false,
      transformResult: (mod, res) => PackageManager.validatePublishedResult(RuntimeContext, mod, res),
    });

    if (this.dryRun) {
      console.log('Unpublished modules', [...published.entries()].filter(x => !x[1]).map(([mod]) => mod.sourceFolder));
    }

    await RepoExecUtil.execOnModules(
      'all', mod => PackageManager.publish(RuntimeContext, mod, this.dryRun),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        showStdout: false,
        filter: mod => published.get(mod) === false
      }
    );
  }
}