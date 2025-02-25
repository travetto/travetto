import { CliCommand, CliUtil } from '@travetto/cli';

import { PackOperation } from './bin/operation.ts';
import { BasePackCommand, PackOperationShape } from './pack.base.ts';

/**
 * Standard zip support for pack
 */
@CliCommand({ with: { module: true } })
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