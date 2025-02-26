import { Runtime } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape } from '@travetto/cli';

import { RestServerHandle } from '../src/types.ts';
import { RestNetUtil } from '../src/util/net.ts';

/**
 * Run a rest server as an application
 */
@CliCommand({ runTarget: true, with: { debugIpc: true, canRestart: true, module: true, env: true } })
export class RunRestCommand implements CliCommandShape {

  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean;

  preMain(): void {
    if (this.port) {
      process.env.REST_PORT = `${this.port}`;
    }
  }

  async main(): Promise<RestServerHandle | void> {
    const { RestApplication } = await import('../src/application/rest.ts');
    try {
      return await DependencyRegistry.runInstance(RestApplication);
    } catch (err) {
      if (RestNetUtil.isInuseError(err) && !Runtime.production && this.killConflict) {
        await RestNetUtil.freePort(err.port);
        return await DependencyRegistry.runInstance(RestApplication);
      }
      throw err;
    }
  }
}