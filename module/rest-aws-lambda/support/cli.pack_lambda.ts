import { CommonPackConfig } from '@travetto/pack/support/bin/types';
import { PackOperation } from '@travetto/pack/support/bin/operation';
import { BasePackCommand, PackOperationShape } from '@travetto/pack/support/pack.base';
import { CliCommand } from '@travetto/cli';

/**
 * Standard lambda support for pack
 */
@CliCommand()
export class PackLambdaCommand extends BasePackCommand {

  initializeFlags(): void {
    this.entryPoint = '@travetto/rest-aws-lambda/support/entry.handler';
    this.mainName = 'index';
    this.output = this.monoRoot ? '<module>.zip' : `${this.getSimpleModuleName()}.zip`;
  }

  getOperations(): PackOperationShape<CommonPackConfig>[] {
    return [...super.getOperations(), PackOperation.compress];
  }
}