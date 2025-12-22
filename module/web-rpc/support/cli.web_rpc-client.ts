import path from 'node:path';

import { Env } from '@travetto/runtime';
import { CliCommand, CliCommandShape, CliValidationResultError } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Ignore } from '@travetto/schema';

import type { WebRpcClient } from '../src/config.ts';
import { WebRpcClientGeneratorService } from '../src/service.ts';

/**
 * Generate the web-rpc client
 */
@CliCommand({ with: { env: true, module: true } })
export class CliWebRpcCommand implements CliCommandShape {

  @Ignore()
  module: string;

  preMain(): void {
    Env.DEBUG.set(false);
  }

  get #service(): Promise<WebRpcClientGeneratorService> {
    return Registry.init().then(() => DependencyRegistryIndex.getInstance(WebRpcClientGeneratorService));
  }

  async main(type: WebRpcClient['type'] | 'config', output?: string): Promise<void> {
    const service = await this.#service;
    if (type === 'config') {
      await service.render();
    } else {
      if (!output) {
        throw new CliValidationResultError(this, [
          { message: 'output is required when type is not `config`', source: 'arg' }
        ]);
      }
      output = path.resolve(output);
      return service.renderProvider({ type, output });
    }
  }
}