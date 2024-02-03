import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Env } from '@travetto/base';
import { RuntimeContext } from '@travetto/manifest';

import { EmailCompiler } from '../src/compiler';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailCompileCommand implements CliCommandShape {

  /** Compile in watch mode */
  watch?: boolean;

  preMain(): void {
    Env.DEBUG.set(false);
    Env.TRV_ROLE.set('build');
    Env.TRV_DYNAMIC.set(this.watch);
  }

  async main(): Promise<void> {
    await RootRegistry.init();

    // Let the engine template
    const all = await EmailCompiler.compileAll();
    console!.log(cliTpl`Successfully compiled ${{ param: `${all.length}` }} templates`);
    for (const el of all) {
      console!.log(cliTpl`  * ${{ param: el.replace(`${RuntimeContext.workspace.path}/`, '') }}`);
    }

    if (this.watch) {
      for await (const _ of EmailCompiler.watchCompile()) {
        // Iterate until done
      }
    }
  }
}