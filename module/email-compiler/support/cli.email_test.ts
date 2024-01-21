import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';

import { EmailCompilationManager } from './bin/manager';
import { EditorConfig } from './bin/config';
import { EditorSendService } from './bin/send';

import { EmailCompiler } from '../src/compiler';

/**
 * CLI Entry point for running the email server
 */
@CliCommand({ addEnv: true })
export class EmailTestCommand implements CliCommandShape {

  async main(file: string, to: string): Promise<void> {
    file = path.resolve(file);
    await RootRegistry.init();
    await EmailCompiler.compile(file, true);

    const mgr = await DependencyRegistry.getInstance(EmailCompilationManager);
    const cfg = await EditorConfig.get();
    const content = await mgr.resolveCompiledTemplate(file, cfg.context ?? {});

    await EditorSendService.sendEmail(file, { from: cfg.from, to, ...content, });
  }
}