import { OptionConfig } from '@travetto/cli';

import { BaseOptions, BasePackCommand } from './cli.pack-base';
import { Assemble, AssembleConfig } from './bin/assemble/operation';

type Options = BaseOptions & {
  keepSource: OptionConfig<boolean>;
  readonly: OptionConfig<boolean>;
};

export class PackAssembleCommand extends BasePackCommand<Options, AssembleConfig, 'assemble'> {
  operation = Assemble;

  getOptions(): Options {
    return {
      ...this.commonOptions(),
      keepSource: this.boolOption({ desc: 'Should source be preserved' }),
      readonly: this.boolOption({ desc: 'Build a readonly deployable' })
    };
  }
}