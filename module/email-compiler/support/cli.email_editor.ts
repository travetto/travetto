import { Env, EnvInit } from '@travetto/base';
import { CliCommand, CliUtil } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';

import { EditorState } from './bin/editor';
import { EmailCompilationManager } from './bin/manager';

/** The email editor compilation service and output serving */
@CliCommand()
export class EmailEditorCommand {

  envInit(): EnvInit {
    Env.addToList('TRV_PROFILES', 'email-dev');
    return { envName: 'dev', dynamic: true };
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this)) {
      return;
    }

    await RootRegistry.init();
    await new EditorState(await EmailCompilationManager.createInstance()).init();
  }
}