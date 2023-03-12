import { BaseCliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

import { PackageManager } from './bin/package-manager';

type Options = {
  dryRun: OptionConfig<boolean>;
};

/**
* `npx trv repo:publish`
*
* Publish all pending modules
*/
export class RepoPublishCommand extends BaseCliCommand<Options> {

  name = 'repo:publish';

  getOptions(): Options {
    return {
      dryRun: this.boolOption({ desc: 'Dry Run?', def: true })
    };
  }

  async action(...args: unknown[]): Promise<void> {
    const published = await CliModuleUtil.execOnModules('all', (mod, opts) => PackageManager.isPublished(RootIndex.manifest, mod, opts), {
      filter: mod => !!mod.local && !mod.internal,
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`,
      showStderr: false,
      transformResult: (mod, res) => PackageManager.validatePublishedResult(RootIndex.manifest, mod, res),
    });

    if (this.cmd.dryRun) {
      console.log('Unpublished modules', [...published.entries()].filter(x => !x[1]).map(([mod]) => mod.sourceFolder));
    }

    await CliModuleUtil.execOnModules(
      'all', (mod, opts) => PackageManager.publish(RootIndex.manifest, mod, this.cmd.dryRun, opts),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        showStdout: false,
        filter: mod => published.get(mod) === false
      }
    );
  }
}