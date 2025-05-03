import path from 'node:path';

import { Env } from '@travetto/runtime';
import { CliCommand, CliCommandShape, CliValidationResultError } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
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
    Env.TRV_DYNAMIC.set(false);
  }

  get #service(): Promise<WebRpcClientGeneratorService> {
    return RootRegistry.init().then(() => DependencyRegistry.getInstance(WebRpcClientGeneratorService));
  }

  async main(type: WebRpcClient['type'] | 'config', output?: string): Promise<void> {
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