import { Runtime } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape } from '@travetto/cli';

import { WebServerHandle } from '../src/types';
import { WebNetUtil } from '../src/util/net';

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
      process.env.REST_PORT = `${this.port}`;
    }
  }

  async main(): Promise<WebServerHandle | void> {
    const { WebApplication } = await import('../src/application/app');
    try {
      return await DependencyRegistry.runInstance(WebApplication);
    } catch (err) {
      if (WebNetUtil.isInuseError(err) && !Runtime.production && this.killConflict) {
        await WebNetUtil.freePort(err.port);
        return await DependencyRegistry.runInstance(WebApplication);
      }
      throw err;
    }
  }
}