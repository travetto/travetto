import { Env } from '@travetto/runtime';
import { CliCommand, CliUtil } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

import { EditorService } from './bin/editor';

/** The email editor compilation service and output serving */
@CliCommand({ addEnv: true })
export class EmailEditorCommand {

  preMain(): void {
    Env.TRV_DYNAMIC.set(true);
    Env.TRV_ROLE.set('build');
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this, true)) {
      return;
    }

    await RootRegistry.init();
    const service = await DependencyRegistry.getInstance(EditorService);
    await service.listen();
  }
}