import { OptionConfig } from '@travetto/cli/src/command';

import { BaseOptions, BasePackCommand } from './pack-base';
import { Assemble, AssembleConfig } from './operation/assemble';

type Options = BaseOptions & {
  keepSource: OptionConfig<boolean>;
  readonly: OptionConfig<boolean>;
};

export class PackAssembleCommand extends BasePackCommand<Options, AssembleConfig> {
  operation = Assemble;

  getOptions(): Options {
    return {
      ...this.defaultOptions(),
      keepSource: this.boolOption({ desc: 'Should source be preserved' }),
      readonly: this.boolOption({ desc: 'Build a readonly deployable' })
    };
  }
}