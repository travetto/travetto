import { CommonPackConfig, CommonPackOptions } from './bin/types';
import { PackOperation } from './bin/operation';
import { BasePackCommand, PackOperationShape } from './pack.base';

/**
 * Standard zip support for pack
 */
export class PackZipCommand extends BasePackCommand<CommonPackOptions, CommonPackConfig> {

  name = 'pack:zip';

  getOptions(): CommonPackOptions {
    const opts = this.getCommonOptions();
    opts.output.def = `${this.getSimpleModuleName()}.zip`;
    return opts;
  }

  getOperations(): PackOperationShape<CommonPackConfig>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}