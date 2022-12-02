import { CliCommand, CliModuleUtil, OptionConfig } from '@travetto/cli';
import { Npm } from './bin/npm';

type Options = {
  dryRun: OptionConfig<boolean>;
}

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
    const withPublished = (await CliModuleUtil.findModules('all'))
      .filter(mod => !mod.internal)
      .map(mod => Npm.isPublished(mod).then(published => [mod, published] as const));

    for (const [mod, published] of await Promise.all(withPublished)) {
      if (!published) {
        await Npm.publish(mod, this.cmd.dryRun);
      }
    }
  }
}