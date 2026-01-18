import { type CliCommandShape, CliCommand } from '@travetto/cli';

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
    const published = await RepoExecUtil.execOnModules('workspace', module => PackageManager.isPublished(module), {
      filter: module => !!module.workspace && !module.internal,
      progressMessage: (module) => `Checking published [%idx/%total] -- ${module?.name}`,
      showStderr: false,
      transformResult: (module, result) => PackageManager.validatePublishedResult(result),
    });

    if (this.dryRun) {
      console.log('Unpublished modules', [...published.entries()].filter(entry => !entry[1]).map(([module]) => module.sourceFolder));
    }

    await RepoExecUtil.execOnModules(
      'workspace', module => PackageManager.publish(module, this.dryRun),
      {
        progressMessage: (module) => `Published [%idx/%total] -- ${module?.name}`,
        showStdout: false,
        filter: module => published.get(module) === false
      }
    );
  }
}