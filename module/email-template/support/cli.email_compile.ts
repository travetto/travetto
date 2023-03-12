import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { MailTemplateEngine } from '@travetto/email/src/template';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';
import { BaseCliCommand, CliCommand, cliTpl } from '@travetto/cli';

import { EmailTemplateCompiler } from '../src/compiler';
import { EmailTemplateResource } from '../src/resource';

import { TemplateManager } from './bin/template';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailCompileCommand implements BaseCliCommand {

  /** Compile in watch mode */
  watch?: boolean;

  async action(): Promise<void> {
    await RootRegistry.init();

    // Let the engine template
    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);
    const resources = new EmailTemplateResource();
    const compiler = new EmailTemplateCompiler(resources);

    const all = await compiler.compileAll(true);
    console!.log(cliTpl`Successfully compiled ${{ param: `${all.length}` }} templates`);

    if (this.watch) {
      const template = new TemplateManager(engine, compiler);
      for await (const _ of template.watchCompile()) {
        // Iterate until done
      }
    }
  }
}