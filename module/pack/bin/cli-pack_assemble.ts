import { BasePackPlugin } from './pack-base';
import { Assemble, AssembleConfig } from './operation/assemble';

export class PackAssemblePlugin extends BasePackPlugin<AssembleConfig> {
  operation = Assemble;
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getOptions() {
    return {
      ...this.defaultOptions(),
      keepSource: this.boolOption({ desc: 'Should source be preserved' }),
      readonly: this.boolOption({ desc: 'Build a readonly deployable' })
    };
  }
}