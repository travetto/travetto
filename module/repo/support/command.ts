import { CliCommand, OptionConfig, OptionMap } from '@travetto/cli';

type Options = {
  dryRun: OptionConfig<boolean>;
}

/** 
 * Base command for all repo actions
 */
export abstract class MutatingRepoCommand<T extends OptionMap = OptionMap> extends CliCommand<Options & T> {

  name = 'repo:upgrade';

  getSelfOptions(): T {
    return {} as T;
  }

  getOptions(): T & Options {
    return {
      ...this.getSelfOptions(),
      dryRun: this.boolOption({ desc: 'Dry Run?', def: true })
    };
  }
}