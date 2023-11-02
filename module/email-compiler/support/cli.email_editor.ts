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
      dynamic: true
    };
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this)) {
      return;
    }

    CliUtil.addProfiles('email-dev');

    await RootRegistry.init();
    await new EditorState(await EmailCompilationManager.createInstance()).init();
  }
}