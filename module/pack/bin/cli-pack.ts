import { BaseOptions, BasePackCommand } from './pack-base';
import { Pack, AllConfig } from './operation/pack';

export class PackCommand extends BasePackCommand<BaseOptions, AllConfig> {
  operation = Pack;

  getOptions(): BaseOptions {
    return this.commonOptions();
  }
}