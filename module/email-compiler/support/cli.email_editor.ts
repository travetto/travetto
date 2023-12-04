import { Env } from '@travetto/base';
import { CliCommand, CliUtil } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';

import { EditorState } from './bin/editor';
import { EmailCompilationManager } from './bin/manager';

/** The email editor compilation service and output serving */
@CliCommand()
export class EmailEditorCommand {

  preMain(): void {
    Env.TRV_ENV.set('dev');
    Env.TRV_DYNAMIC.set(true);
    Env.TRV_PROFILES.set(['email-dev']);
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this)) {
      return;
    }

    await RootRegistry.init();
    await new EditorState(await EmailCompilationManager.createInstance()).init();
  }
}