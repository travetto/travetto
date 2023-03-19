import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';

import { TemplateManager } from './bin/template';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailCompileCommand implements CliCommandShape {

  /** Compile in watch mode */
  watch?: boolean;

  async main(): Promise<void> {
    await RootRegistry.init();

    const template = await TemplateManager.createInstance();

    // Let the engine template
    const all = await template.compiler.compileAll(true);
    console!.log(cliTpl`Successfully compiled ${{ param: `${all.length}` }} templates`);

    if (this.watch) {
      for await (const _ of template.watchCompile()) {
        // Iterate until done
      }
    }
  }
}