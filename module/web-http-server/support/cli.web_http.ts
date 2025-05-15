import { Runtime, ShutdownManager, toConcrete } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape } from '@travetto/cli';
import { NetUtil } from '@travetto/web';
import { RootRegistry } from '@travetto/registry';

import type { WebHttpServer } from '../src/types.ts';
import { DefaultWebServer } from '../src/default.ts';

/**
 * Run a web server
 */
@CliCommand({ runTarget: true, with: { debugIpc: true, canRestart: true, module: true, env: true } })
export class WebHttpCommand implements CliCommandShape {

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
    let instanceTypes = await DependencyRegistry.getCandidateTypes(toConcrete<WebHttpServer>());

    if (instanceTypes.length === 0) {
      instanceTypes = await DependencyRegistry.getCandidateTypes(DefaultWebServer);
    }

    const instance = await DependencyRegistry.getInstance(instanceTypes[0].class, instanceTypes[0].qualifier);

    let res;
    try {
      res = await instance.serve();
    } catch (err) {
      if (NetUtil.isPortUsedError(err) && !Runtime.production && this.killConflict) {
        await NetUtil.freePort(err.port);
        res = await instance.serve();
      }
      throw err;
    }
    ShutdownManager.onGracefulShutdown(res.kill, this);
    return res.wait;
  }
}