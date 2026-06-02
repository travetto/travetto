import { Registry } from '@travetto/registry';
import { type CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Env, Runtime, WatchUtil } from '@travetto/runtime';

import { EmailCompiler } from '../src/compiler.ts';
import { EmailCompileUtil } from '../src/util.ts';

/**
 * Compile all email templates into generated runtime artifacts.
 *
 * The command discovers templated inputs (for example, `.email.html`) and emits
 * compiled outputs used at runtime (html/text/subject variants). With watch
 * enabled, recompilation runs automatically on matching template changes.
 */
@CliCommand()
export class EmailCompileCommand implements CliCommandShape {

  /** Recompile templates whenever source templates change. */
  watch?: boolean;

  finalize(): void {
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
      await WatchUtil.watchCompilerEvents('change',
        ({ file }) => EmailCompiler.spawnCompile(file),
        ({ file }) => EmailCompileUtil.isTemplateFile(file));
    }
  }
}