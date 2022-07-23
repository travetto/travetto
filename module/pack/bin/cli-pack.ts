import { BasePackPlugin } from './pack-base';
import { Pack, AllConfig } from './operation/pack';

export class PackPlugin extends BasePackPlugin<AllConfig> {
  operation = Pack;

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getOptions() {
    return this.defaultOptions();
  }
}