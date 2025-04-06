import { Runtime, toConcrete } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape } from '@travetto/cli';

import type { WebApplication, WebApplicationHandle } from '../src/types/application.ts';
import { NetUtil } from '../src/util/net.ts';

/**
 * Run a web server as an application
 */
@CliCommand({ runTarget: true, with: { debugIpc: true, canRestart: true, module: true, env: true } })
export class RunWebCommand implements CliCommandShape {

  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean;

  preMain(): void {
    if (this.port) {
      process.env.WEB_PORT = `${this.port}`;
    }
  }

  async main(): Promise<WebApplicationHandle | void> {
    try {
      return await DependencyRegistry.runInstance(toConcrete<WebApplication>());
    } catch (err) {
      if (NetUtil.isPortUsedError(err) && !Runtime.production && this.killConflict) {
        await NetUtil.freePort(err.port);
        return await DependencyRegistry.runInstance(toConcrete<WebApplication>());
      }
      throw err;
    }
  }
}