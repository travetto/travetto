import { Runtime, toConcrete, Util } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape } from '@travetto/cli';
import { NetUtil } from '@travetto/web';
import { RootRegistry } from '@travetto/registry';

import type { WebHttpServer } from '../src/types.ts';

/**
 * Run a web server
 */
@CliCommand({ runTarget: true, with: { debugIpc: true, canRestart: true, module: true, env: true } })
export class WebServerCommand implements CliCommandShape {

  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean;

  preMain(): void {
    if (this.port) {
      process.env.WEB_HTTP_PORT = `${this.port}`;
    }
  }

  async main(): Promise<void> {
    await RootRegistry.init();
    const instance = await DependencyRegistry.getInstance(toConcrete<WebHttpServer>());

    const handle = await Util.acquireWithRetry(
      () => instance.serve(),
      NetUtil.freePortOnConflict,
      this.killConflict && !Runtime.production ? 5 : 1
    );

    return handle.complete;
  }
}