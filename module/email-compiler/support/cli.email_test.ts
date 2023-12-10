import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';

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

    const mgr = await EmailCompilationManager.createInstance();
    const cfg = await EditorConfig.get(file);
    const content = await mgr.resolveCompiledTemplate(file, await EditorConfig.getContext(file));

    await EditorSendService.sendEmail(file, { from: cfg.from, to, ...content, });
  }
}