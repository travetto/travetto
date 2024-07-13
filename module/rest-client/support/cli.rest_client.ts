import path from 'node:path';

import { Env } from '@travetto/base';
import { CliCommand, CliCommandShape, CliValidationResultError } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { Ignore } from '@travetto/schema';

import type { RestClientProvider } from '../src/config';
import { RestClientGeneratorService } from '../src/service';

/**
 * Run client rest operation
 */
@CliCommand({ addModule: true, addEnv: true })
export class CliRestClientCommand implements CliCommandShape {

  @Ignore()
  module: string;

  preMain(): void {
    Env.DEBUG.set(false);
    Env.TRV_DYNAMIC.set(true);
  }

  get #service(): Promise<RestClientGeneratorService> {
    return RootRegistry.init().then(() => DependencyRegistry.getInstance(RestClientGeneratorService));
  }

  async main(type: RestClientProvider['type'] | 'config', output?: string): Promise<void> {
    if (type === 'config') {
      const svc = await this.#service;
      for (const provider of svc.providers) {
        await svc.renderClient(provider);
      }
    } else {
      if (!output) {
        throw new CliValidationResultError(this, [
          { message: 'output is required when type is not `config`', source: 'arg' }
        ]);
      }
      const svc = await this.#service;
      output = path.resolve(output);
      return svc.renderClient({ type, output, moduleName: this.module, });
    }
  }
}