import { CommonPackConfig, CommonPackOptions } from '@travetto/pack/support/bin/types';
import { PackOperation } from '@travetto/pack/support/bin/operation';
import { BasePackCommand, PackOperationShape } from '@travetto/pack/support/pack.base';

/**
 * Standard lambda support for pack
 */
export class PackLambdaCommand extends BasePackCommand<CommonPackOptions, CommonPackConfig> {

  name = 'pack:lambda';

  getArgs(): string | undefined {
    return this.monoRoot ? '<module>' : '';
  }

  getOptions(): CommonPackOptions {
    const opts = this.getCommonOptions();
    opts.entryPoint.def = '@travetto/rest-aws-lambda/support/entry.handler';
    opts.output.def = this.monoRoot ? '<module>.zip' : `${this.getSimpleModuleName()}.zip`;
    return opts;
  }

  getOperations(): PackOperationShape<CommonPackConfig>[] {
    return [
      ...super.getOperations().filter(x => x !== PackOperation.writeEntryScript),
      PackOperation.compress
    ];
  }
}