import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand, CliUtil } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';

import { EditorState } from './bin/editor';
import { EmailCompilationManager } from './bin/manager';

/** The email editor compilation service and output serving */
@CliCommand()
export class EmailEditorCommand {

  envInit(): GlobalEnvConfig {
    return {
      envName: 'dev',
      dynamic: true,
      profiles: ['email-dev']
    };
  }

  async main(): Promise<void> {
    if (await CliUtil.runAsRestartable()) {
      return;
    }
    await RootRegistry.init();
    await new EditorState(await EmailCompilationManager.createInstance()).init();
  }
}