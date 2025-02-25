import path from 'node:path';

import { Env } from '@travetto/runtime';
import { CliCommand, CliCommandShape, CliValidationResultError } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { Ignore } from '@travetto/schema';

import type { RestRpcClient } from '../src/config';
import { RestRpcClientGeneratorService } from '../src/service';

/**
 * Run client rest operation
 */
@CliCommand({ with: { env: true, module: true } })
export class CliRestRpcCommand implements CliCommandShape {

  @Ignore()
  module: string;

  preMain(): void {
    Env.DEBUG.set(false);
    Env.TRV_DYNAMIC.set(false);
  }

  get #service(): Promise<RestRpcClientGeneratorService> {
    return RootRegistry.init().then(() => DependencyRegistry.getInstance(RestRpcClientGeneratorService));
  }

  async main(type: RestRpcClient['type'] | 'config', output?: string): Promise<void> {
    if (type === 'config') {
      const svc = await this.#service;
      await svc.render();
    } else {
      if (!output) {
        throw new CliValidationResultError(this, [
          { message: 'output is required when type is not `config`', source: 'arg' }
        ]);
      }
      const svc = await this.#service;
      output = path.resolve(output);
      return svc.renderProvider({ type, output });
    }
  }
}