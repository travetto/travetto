import path from 'node:path';

import { CliCommand, type CliCommandShape, CliProfilesFlag } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Env } from '@travetto/runtime';

import { EditorService } from './bin/editor.ts';

/**
 * Render and send a template file to a target recipient for quick validation.
 *
 * This command is useful during template development to verify real delivery and
 * formatting without running the full editor workflow.
 */
@CliCommand()
export class EmailTestCommand implements CliCommandShape {
  @CliProfilesFlag()
  profile: string[];

  finalize(): void {
    Env.TRV_ROLE.set('build');
  }

  async main(file: string, to: string): Promise<void> {
    file = path.resolve(file);
    await Registry.init();
    const editor = await DependencyRegistryIndex.getInstance(EditorService);
    await editor.sendFile(file, to);
  }
}
