import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';

import { TemplateManager } from './bin/template';
import { EditorState } from './bin/editor';
import { GlobalEnvConfig } from '@travetto/base';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailTestCommand implements CliCommandShape {

  envInit(): GlobalEnvConfig {
    return { envName: 'dev' };
  }

  async main(file: string, to: string): Promise<void> {
    file = path.resolve(file).split('resources/')[1];
    await RootRegistry.init();
    const template = await TemplateManager.createInstance();
    await template.compiler.compile(file, true);
    const editor = new EditorState(await TemplateManager.createInstance());
    await editor.onConfigure({ type: 'configure' });
    await editor.onSend({ type: 'send', file, to });
  }
}