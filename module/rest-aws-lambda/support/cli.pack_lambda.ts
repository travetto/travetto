import { CliCommand, CliUtil } from '@travetto/cli';
import { PackOperation } from '@travetto/pack/support/bin/operation';
import { BasePackCommand, PackOperationShape } from '@travetto/pack/support/pack.base';

/**
 * Standard lambda support for pack
 */
@CliCommand({ fields: ['module'] })
export class PackLambdaCommand extends BasePackCommand {

  initialize(): void {
    this.entryPoint = '@travetto/rest-aws-lambda/support/entry.handler';
    this.output = CliUtil.monoRoot ? '<module>.zip' : `${CliUtil.getSimpleModuleName()}.zip`;
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}