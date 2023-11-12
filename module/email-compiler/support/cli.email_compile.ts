import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Env, EnvInit } from '@travetto/base';

import { EmailCompiler } from '../src/compiler';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailCompileCommand implements CliCommandShape {

  /** Compile in watch mode */
  watch?: boolean;

  envInit(): EnvInit {
    Env.addToList('TRV_PROFILES', 'email-dev');
    return { debug: false, dynamic: this.watch };
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