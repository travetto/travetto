import { CliCommand, CliUtil } from '@travetto/cli';

import { PackOperation } from './bin/operation.ts';
import { BasePackCommand, type PackOperationShape } from './pack.base';

/**
 * Standard zip support for pack
 */
@CliCommand()
export class PackZipCommand extends BasePackCommand {

  finalize(forHelp?: boolean): void {
    if (forHelp) {
      this.output = CliUtil.getSimpleModuleName('<module>.zip');
    } else {
      this.output ??= CliUtil.getSimpleModuleName('<module>.zip', this.module);
    }
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}