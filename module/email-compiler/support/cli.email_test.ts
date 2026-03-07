import path from 'node:path';

import { Registry } from '@travetto/registry';
import { type CliCommandShape, CliCommand, CliProfilesFlag } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Env } from '@travetto/runtime';

import { EditorService } from './bin/editor.ts';

/**
 * CLI Entry point for running the email server
 */
@CliCommand()
export class EmailTestCommand implements CliCommandShape {

  @CliProfilesFlag()
  profiles: string[];

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