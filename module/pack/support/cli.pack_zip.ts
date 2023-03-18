import { CliCommand, CliUtil } from '@travetto/cli';

import { PackOperation } from './bin/operation';
import { BasePackCommand, PackOperationShape } from './pack.base';

/**
 * Standard zip support for pack
 */
@CliCommand({ fields: ['module'] })
export class PackZipCommand extends BasePackCommand {

  initializeFlags(): void {
    this.output = CliUtil.monoRoot ? '<module>.zip' : `${CliUtil.getSimpleModuleName()}.zip`;
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}