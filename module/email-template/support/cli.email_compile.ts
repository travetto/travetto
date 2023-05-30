import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';

import { TemplateManager } from './bin/template';
import { GlobalEnvConfig } from '@travetto/base';

/**
 * CLI Entry point for running the email server
 */
@CliCommand({ fields: ['module'] })
export class EmailCompileCommand implements CliCommandShape {

  /** Compile in watch mode */
  watch?: boolean;

  envInit(): GlobalEnvConfig {
    return {
      debug: false,
      dynamic: this.watch
    };
  }

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