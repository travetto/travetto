import fs from 'fs/promises';

import { CliCommandShape, CliCommand } from '@travetto/cli';
import { GlobalEnvConfig } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { path } from '@travetto/manifest';

/**
 * CLI for outputting the open api spec to a local file
 */
@CliCommand({ fields: ['module'] })
export class OpenApiSpecCommand implements CliCommandShape {

  /** Output files */
  output?: string;

  envInit(): GlobalEnvConfig {
    return { debug: false };
  }

  async main(): Promise<void> {
    const { OpenApiService } = await import('../src/service.js');

    await RootRegistry.init();

    const instance = await DependencyRegistry.getInstance(OpenApiService);
    const result = instance.spec;

    if (this.output === '-' || !this.output) {
      console.log!(JSON.stringify(result, null, 2));
    } else {
      await fs.mkdir(path.dirname(this.output), { recursive: true });
      await fs.writeFile(this.output, JSON.stringify(result, null, 2), 'utf8');
    }
  }
}