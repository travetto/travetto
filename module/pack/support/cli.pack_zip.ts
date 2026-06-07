import { CliCommand, CliUtil } from '@travetto/cli';

import { PackOperation } from './bin/operation.ts';
import { BasePackCommand, type PackOperationShape } from './pack.base.ts';

/**
 * Build a deployable zip artifact using the standard pack pipeline.
 *
 * This command runs base packing operations and then compresses the generated
 * output into a single archive file.
 */
@CliCommand()
export class PackZipCommand extends BasePackCommand {

  finalize(forHelp?: boolean): void {
    if (forHelp) {
      this.output = '<module>.zip';
    }
    this.output ??= CliUtil.getSimpleModuleName('<module>.zip', this.module);
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}