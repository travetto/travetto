import { Env } from '@travetto/runtime';
import { CliCommand, CliCommandShape } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';
import { Ignore } from '@travetto/schema';

import { AngularClientGenerator } from '../src/angular';
import { FetchClientGenerator } from '../src/fetch';

/**
 * Run client rest operation
 */
@CliCommand({ with: { env: true, module: true } })
export class CliRestClientCommand implements CliCommandShape {

  @Ignore()
  module: string;

  preMain(): void {
    Env.DEBUG.set(false);
    Env.TRV_DYNAMIC.set(false);
  }

  async main(type: 'angular' | 'fetch-node' | 'fetch-web', output: string): Promise<void> {
    await RootRegistry.init();
    switch (type) {
      case 'angular': return new AngularClientGenerator(output, this.module, {}).render();
      case 'fetch-node': return new FetchClientGenerator(output, this.module, { node: true }).render();
      case 'fetch-web': return new FetchClientGenerator(output, this.module, { node: false }).render();
    }
  }
}