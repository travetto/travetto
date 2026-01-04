import { Runtime, toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { CliCommand, CliCommandShape } from '@travetto/cli';
import { NetUtil } from '@travetto/web';
import { Registry } from '@travetto/registry';

import type { WebHttpServer } from '../src/types.ts';

/**
 * Run a web server
 */
@CliCommand({ runTarget: true, with: { debugIpc: 'optional', restartOnChange: true, module: true, env: true } })
export class WebHttpCommand implements CliCommandShape {

  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean = Runtime.envType === 'development';

  preMain(): void {
    if (this.port) {
      process.env.WEB_HTTP_PORT = `${this.port}`;
    }
  }

  async main(): Promise<void> {
    await Registry.init();
    const instance = await DependencyRegistryIndex.getInstance(toConcrete<WebHttpServer>());

    try {
      const handle = await instance.serve();
      return handle.complete;
    } catch (err) {
      if (NetUtil.isPortUsedError(err) && this.killConflict) {
        await NetUtil.freePort(err.port);
        console.log(`Killed process on port ${err.port}`);
        process.exit(1);
      }
      throw err;
    }
  }
}