import { CliCommand, CliUtil } from '@travetto/cli';

import { PackOperation } from './bin/operation';
import { BasePackCommand, PackOperationShape } from './pack.base';

/**
 * Standard zip support for pack
 */
@CliCommand({ addModule: true })
export class PackZipCommand extends BasePackCommand {

  preMain(): void {
    this.output ??= CliUtil.getSimpleModuleName('<module>.zip', this.module);
  }

  preHelp(): void {
    this.output = CliUtil.getSimpleModuleName('<module>.zip');
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}