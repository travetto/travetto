import path from 'node:path';

import { Env } from '@travetto/runtime';
import { CliCommand, type CliCommandShape, CliModuleFlag, CliProfilesFlag } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { ValidationResultError } from '@travetto/schema';

import type { WebRpcClient } from '../src/config.ts';
import { WebRpcClientGeneratorService } from '../src/service.ts';

/**
 * Generate web-rpc client artifacts from a specified provider or leveraging local config.
 *
 * Resolves generator services from DI and writes typed client code for the
 * selected provider target.
 */
@CliCommand()
export class CliWebRpcCommand implements CliCommandShape {
  @CliProfilesFlag()
  profile: string[];

  @CliModuleFlag({ short: 'm' })
  module: string;

  finalize(): void {
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
        throw new ValidationResultError([
          { message: 'output is required when type is not `config`', source: 'arg', kind: 'missing', path: 'output' }
        ]);
      }
      output = path.resolve(output);
      return service.renderProvider({ type, output });
    }
  }
}
