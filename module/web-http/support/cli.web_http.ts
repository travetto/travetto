import { Runtime, WatchUtil, toConcrete } from '@travetto/runtime';
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

    if (this.killConflict) {
      const handle = await WatchUtil.acquireWithRetry(() => instance.serve(), NetUtil.freePortOnConflict, 5);
      return handle.complete;
    } else {
      const handle = await instance.serve();
      return handle.complete;
    }
  }
}