import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { MailTemplateEngine } from '@travetto/email/src/template';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';
import { CliCommand, cliTpl, OptionConfig } from '@travetto/cli';

import { EmailTemplateCompiler } from '../src/compiler';
import { EmailTemplateResource } from '../src/resource';

import { TemplateManager } from './bin/template';

type Options = {
  watch: OptionConfig<boolean>;
};

/**
 * CLI Entry point for running the email server
 */
export class EmailCompileCommand extends CliCommand<Options> {
  name = 'email:compile';

  getOptions(): Options {
    return { watch: this.boolOption({ desc: 'Compile in watch mode' }) };
  }

  async action(): Promise<void> {
    await RootRegistry.init();

    // Let the engine template
    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);
    const resources = new EmailTemplateResource();
    const compiler = new EmailTemplateCompiler(resources);

    const all = await compiler.compileAll(true);
    console!.log(cliTpl`Successfully compiled ${{ param: `${all.length}` }} templates`);

    if (this.cmd.watch) {
      try {
        const template = new TemplateManager(engine, compiler);
        await template.watchCompile();
        await new Promise(r => process.on('exit', r));
      } catch {
        return this.exit(1);
      }
    }
  }
}