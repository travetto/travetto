import { BaseOptions, BasePackCommand } from './cli.pack-base';
import { Pack, AllConfig } from './bin/pack';

export class PackCommand extends BasePackCommand<BaseOptions, AllConfig, ''> {
  operation = Pack;

  getOptions(): BaseOptions {
    return this.commonOptions();
  }
}