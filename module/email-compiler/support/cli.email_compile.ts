import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Env } from '@travetto/base';

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
    Env.TRV_DYNAMIC.set(this.watch);
    Env.TRV_PROFILES.set(['email-dev']);
  }

  async main(): Promise<void> {
    await RootRegistry.init();

    // Let the engine template
    const all = await EmailCompiler.compileAll();
    console!.log(cliTpl`Successfully compiled ${{ param: `${all.length}` }} templates`);
    for (const el of all) {
      console!.log(cliTpl`  * ${{ param: el }}`);
    }

    if (this.watch) {

      for await (const _ of EmailCompiler.watchCompile()) {
        // Iterate until done
      }
    }
  }
}