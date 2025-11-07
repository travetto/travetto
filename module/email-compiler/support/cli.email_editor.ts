import { Env } from '@travetto/runtime';
import { CliCommand, CliUtil } from '@travetto/cli';
import { RegistryV2 } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';

import { EditorService } from './bin/editor.ts';

/** The email editor compilation service and output serving */
@CliCommand({ with: { env: true } })
export class EmailEditorCommand {

  preMain(): void {
    Env.TRV_DYNAMIC.set(true);
    Env.TRV_ROLE.set('build');
  }

  async main(): Promise<void> {
    if (await CliUtil.runWithRestart(this, true)) {
      return;
    }

    await RegistryV2.init();
    const service = await DependencyRegistryIndex.getInstance(EditorService);
    await service.listen();
  }
}