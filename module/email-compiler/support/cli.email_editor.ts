import { Env } from '@travetto/runtime';
import { CliCommand, CliProfilesSupport } from '@travetto/cli';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';

import { EditorService } from './bin/editor.ts';

/** The email editor compilation service and output serving */
@CliProfilesSupport()
@CliCommand()
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