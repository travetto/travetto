import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { GlobalEnvConfig } from '@travetto/base';

import { EmailCompilationManager } from './bin/manager';
import { EditorState } from './bin/editor';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailTestCommand implements CliCommandShape {

  envInit(): GlobalEnvConfig {
    return { envName: 'dev' };
  }

  async main(file: string, to: string): Promise<void> {
    file = path.resolve(file);
    await RootRegistry.init();
    const template = await EmailCompilationManager.createInstance();
    await template.compiler.compile(file, true);
    const editor = new EditorState(await EmailCompilationManager.createInstance());
    await editor.onConfigure({ type: 'configure' });
    await editor.onSend({ type: 'send', file, to });
  }
}