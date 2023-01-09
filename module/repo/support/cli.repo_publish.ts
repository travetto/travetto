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
    const published = await CliModuleUtil.runOnModules('all', mod => Npm.isPublished(mod), {
      progressMessage: (mod) => `Checking published [%idx/%total] -- ${mod?.name}`
    });

    await CliModuleUtil.runOnModules(
      'all', mod => Npm.publish(mod, this.cmd.dryRun),
      {
        progressMessage: (mod) => `Published [%idx/%total] -- ${mod?.name}`,
        filter: mod => published.get(mod) === false
      }
    );
  }
}