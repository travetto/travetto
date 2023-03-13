import { CliCommand } from '@travetto/cli';

import { PackOperation } from './bin/operation';
import { BasePackCommand, PackOperationShape } from './pack.base';

/**
 * Standard zip support for pack
 */
@CliCommand()
export class PackZipCommand extends BasePackCommand {

  initializeFlags(): void {
    this.output = PackZipCommand.monoRoot ? '<module>.zip' : `${PackZipCommand.getSimpleModuleName()}.zip`;
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}