import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommandShape, CliCommand } from '@travetto/cli';
import { Env } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';

/**
 * CLI for outputting the open api spec to a local file
 */
@CliCommand({ with: { module: true } })
export class OpenApiSpecCommand implements CliCommandShape {

  /** Output files */
  output?: string;

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    const { OpenApiService } = await import('../src/service.ts');

    await Registry.init();

    const instance = await DependencyRegistryIndex.getInstance(OpenApiService);
    const result = await instance.getSpec();

    if (this.output === '-' || !this.output) {
      console.log!(JSON.stringify(result, null, 2));
    } else {
      await fs.mkdir(path.dirname(this.output), { recursive: true });
      await fs.writeFile(this.output, JSON.stringify(result, null, 2), 'utf8');
    }
  }
}