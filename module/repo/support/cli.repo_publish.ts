import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { Npm } from './bin/npm';

type Options = {
  dryRun: OptionConfig<boolean>;
};

/**
* `npx trv repo:publish`
*
* Publish all pending modules
*/
export class RepoPublishCommand extends CliCommand<Options> {

  name = 'repo:publish';

  getOptions(): Options {
    return {
      dryRun: this.boolOption({ desc: 'Dry Run?', def: true })
    };
  }

  async action(...args: unknown[]): Promise<void> {
    const published = await CliModuleUtil.execOnModules('all', (mod, opts) => Npm.isPublished(mod, opts), {
      filter: mod => !!mod.local && !mod.internal,
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`,
      showStderr: true,
      transformResult: Npm.validatePublishedResult,
    });

    if (this.cmd.dryRun) {
      console.log('Published state', [...published.entries()]);
    }

    await CliModuleUtil.execOnModules(
      'all', (mod, opts) => Npm.publish(mod, this.cmd.dryRun, opts),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        showStdout: false,
        filter: mod => published.get(mod) === false
      }
    );
  }
}