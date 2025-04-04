import { CliCommand, CliUtil } from '@travetto/cli';
import { PackOperation } from '@travetto/pack/support/bin/operation.ts';
import { BasePackCommand, PackOperationShape } from '@travetto/pack/support/pack.base.ts';

/**
 * Standard lambda support for pack
 */
@CliCommand({ with: { module: true } })
export class PackLambdaCommand extends BasePackCommand {

  preMain(): void {
    this.entryPoint ??= '@travetto/web-aws-lambda/support/entry.handler.ts';
    this.output ??= CliUtil.getSimpleModuleName('<module>.zip', this.module);
    this.mainScripts = false;
  }

  preHelp(): void {
    this.output = undefined!;
    this.entryPoint = undefined!;
    this.preMain();
  }

  getOperations(): PackOperationShape<this>[] {
    return [
      ...super.getOperations(),
      PackOperation.compress
    ];
  }
}