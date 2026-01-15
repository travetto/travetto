import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';

import { EditorService } from './bin/editor.ts';

/** The email editor compilation service and output serving */
@CliCommand({ with: { profiles: true } })
export class EmailEditorCommand {

  preMain(): void {
    Env.TRV_ROLE.set('build');
  }

  async main(): Promise<void> {
    await Registry.init();
    const service = await DependencyRegistryIndex.getInstance(EditorService);
    await service.listen();
  }
}