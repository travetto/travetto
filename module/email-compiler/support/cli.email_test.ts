import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { Env, GlobalEnvConfig } from '@travetto/base';

import { EmailCompilationManager } from './bin/manager';
import { EditorConfig } from './bin/config';
import { EditorSendService } from './bin/send';

import { EmailCompiler } from '../src/compiler';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailTestCommand implements CliCommandShape {

  envInit(): GlobalEnvConfig {
    return { envName: 'dev' };
  }

  async main(file: string, to: string): Promise<void> {
    Env.addToList('TRV_PROFILES', 'email-dev');

    file = path.resolve(file);
    await RootRegistry.init();
    await EmailCompiler.compile(file, true);

    const mgr = await EmailCompilationManager.createInstance();
    const cfg = await EditorConfig.get(file);
    const content = await mgr.resolveCompiledTemplate(file, await EditorConfig.getContext(file));

    await EditorSendService.sendEmail(file, { from: cfg.from, to, ...content, });
  }
}