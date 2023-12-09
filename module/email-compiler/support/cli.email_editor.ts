import { Env } from '@travetto/base';
import { CliCommand, CliUtil } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';

import { EditorState } from './bin/editor';
import { EmailCompilationManager } from './bin/manager';

/** The email editor compilation service and output serving */
@CliCommand({ addEnv: true })
export class EmailEditorCommand {

  preMain(): void {
    Env.TRV_DYNAMIC.set(true);
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this)) {
      return;
    }

    await RootRegistry.init();
    await new EditorState(await EmailCompilationManager.createInstance()).init();
  }
}