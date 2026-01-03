import { Registry } from '@travetto/registry';
import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Env, Runtime, compilerWatcher } from '@travetto/runtime';

import { EmailCompiler } from '../src/compiler.ts';

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
  }

  async main(): Promise<void> {
    await Registry.init();

    // Let the engine template
    const locations = await EmailCompiler.compileAll();
    console!.log(cliTpl`Successfully compiled ${{ param: `${locations.length}` }} templates`);
    for (const location of locations) {
      console!.log(cliTpl`  * ${{ param: Runtime.stripWorkspacePath(location) }}`);
    }

    if (this.watch) {
      await compilerWatcher({
        onChange: async ({ file }) => {
          await EmailCompiler.spawnCompile(file);
        }
      });
    }
  }
}