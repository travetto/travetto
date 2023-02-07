import { BasePackCommand } from './pack.base';
import { CommonPackConfig, CommonPackOptions } from './bin/types';

/**
 * Standard pack support
 */
export class PackCommand extends BasePackCommand<CommonPackOptions, CommonPackConfig> {

  name = 'pack';

  getOptions(): CommonPackOptions {
    return this.getCommonOptions();
  }
}