import { Runtime, toConcrete } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape, RunResponse } from '@travetto/cli';
import { NetUtil } from '@travetto/web';

import type { WebServer } from '../src/types.ts';

/**
 * Run a web server
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

  async main(): Promise<RunResponse | void> {
    try {
      return await DependencyRegistry.runInstance(toConcrete<WebServer>());
    } catch (err) {
      if (NetUtil.isPortUsedError(err) && !Runtime.production && this.killConflict) {
        await NetUtil.freePort(err.port);
        return await DependencyRegistry.runInstance(toConcrete<WebServer>());
      }
      throw err;
    }
  }
}