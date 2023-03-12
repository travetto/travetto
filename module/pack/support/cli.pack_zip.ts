import { CliCommand } from '@travetto/cli';

import { PackOperation } from './bin/operation';
import { BasePackCommand, PackOperationShape } from './pack.base';

/**
 * Standard zip support for pack
 */
@CliCommand()
export class PackZipCommand extends BasePackCommand {

  constructor() {
    super();
    this.output = this.monoRoot ? '<module>.zip' : `${this.getSimpleModuleName()}.zip`;
  }

  getOperations(): PackOperationShape[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}