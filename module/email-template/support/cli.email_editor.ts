import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';

import { EditorState } from './bin/editor';
import { TemplateManager } from './bin/template';

/** The email editor compilation service and output serving */
@CliCommand()
export class EmailEditorCommand {

  envInit(): GlobalEnvConfig {
    return {
      resourcePaths: [`${RootIndex.getModule('@travetto/email-template')!.sourcePath}/resources`]
    };
  }

  async main(): Promise<void> {
    await RootRegistry.init();
    const editor = new EditorState(await TemplateManager.createInstance());
    await editor.init();
    process.send?.('ready');
  }
}