import { CommonPackConfig } from '@travetto/pack/support/bin/types';
import { PackOperation } from '@travetto/pack/support/bin/operation';
import { BasePackCommand, PackOperationShape } from '@travetto/pack/support/pack.base';
import { CliCommand } from '@travetto/cli';

/**
 * Standard lambda support for pack
 */
@CliCommand()
export class PackLambdaCommand extends BasePackCommand {

  entryPoint = '@travetto/rest-aws-lambda/support/entry.handler';
  mainName = 'index';
  output = this.monoRoot ? '<module>.zip' : `${this.getSimpleModuleName()}.zip`;

  getArgs(): string | undefined {
    return this.monoRoot ? '<module>' : '';
  }

  getOperations(): PackOperationShape<CommonPackConfig>[] {
    return [...super.getOperations(), PackOperation.compress];
  }
}