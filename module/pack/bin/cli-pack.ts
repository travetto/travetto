import { BaseOptions, BasePackPlugin } from './pack-base';
import { Pack, AllConfig } from './operation/pack';

export class PackPlugin extends BasePackPlugin<BaseOptions, AllConfig> {
  operation = Pack;

  getOptions(): BaseOptions {
    return this.defaultOptions();
  }
}