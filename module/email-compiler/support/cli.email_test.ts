import path from 'node:path';

import { RegistryV2 } from '@travetto/registry';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Env } from '@travetto/runtime';

import { EditorService } from './bin/editor.ts';

/**
 * CLI Entry point for running the email server
 */
@CliCommand({ with: { env: true } })
export class EmailTestCommand implements CliCommandShape {

  preMain(): void {
    Env.TRV_ROLE.set('build');
  }

  async main(file: string, to: string): Promise<void> {
    file = path.resolve(file);
    await RegistryV2.init();
    const editor = await DependencyRegistryIndex.getInstance(EditorService);
    await editor.sendFile(file, to);
  }
}