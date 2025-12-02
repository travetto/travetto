import { CliCommandShape, CliCommand } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

import { PackageManager } from './bin/package-manager.ts';
import { RepoExecUtil } from './bin/exec.ts';

/**
 * Publish all pending modules
 */
@CliCommand()
export class RepoPublishCommand implements CliCommandShape {

  /** Dry Run? */
  dryRun = true;

  async main(): Promise<void> {
    const published = await RepoExecUtil.execOnModules('workspace', mod => PackageManager.isPublished(Runtime, mod), {
      filter: mod => !!mod.workspace && !mod.internal,
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`,
      showStderr: false,
      transformResult: (mod, result) => PackageManager.validatePublishedResult(Runtime, mod, result),
    });

    if (this.dryRun) {
      console.log('Unpublished modules', [...published.entries()].filter(x => !x[1]).map(([mod]) => mod.sourceFolder));
    }

    await RepoExecUtil.execOnModules(
      'workspace', mod => PackageManager.publish(Runtime, mod, this.dryRun),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        showStdout: false,
        filter: mod => published.get(mod) === false
      }
    );
  }
}