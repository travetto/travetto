import { GlobalEnvConfig, ShutdownManager } from '@travetto/base';
import { CliCommand } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';

import { EditorState } from './bin/editor';
import { EmailCompilationManager } from './bin/manager';

/** The email editor compilation service and output serving */
@CliCommand()
export class EmailEditorCommand {

  envInit(): GlobalEnvConfig {
    return {
      envName: 'dev',
      resourcePaths: [`${RootIndex.getModule('@travetto/email-compiler')!.sourcePath}/resources`]
    };
  }

  async main(): Promise<void> {
    await RootRegistry.init();
    const editor = new EditorState(await EmailCompilationManager.createInstance());
    await editor.init();
    if (process.send) {
      process.on('disconnect', () => ShutdownManager.execute());
      process.send('ready');
    }
  }
}