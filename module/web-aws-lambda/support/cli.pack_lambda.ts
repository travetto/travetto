import { CliCommand, CliUtil } from '@travetto/cli';
import { PackOperation } from '@travetto/pack/support/bin/operation.ts';
import { BasePackCommand, type PackOperationShape } from '@travetto/pack/support/pack.base.ts';

/**
 * Standard lambda support for pack
 */
@CliCommand()
export class PackLambdaCommand extends BasePackCommand {

  constructor() {
    super();
    this.entryPoint = '@travetto/web-aws-lambda/support/entry.handler.ts';
  }

  finalize(forHelp?: boolean): void {
    if (forHelp) {
      this.output = '<module>.zip';
    }
    this.output ??= CliUtil.getSimpleModuleName('<module>.zip', this.module);
    this.mainScripts = false;
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}