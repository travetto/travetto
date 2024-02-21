import { Env } from '@travetto/base';
import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliCommandShape, CliUtil } from '@travetto/cli';

import { ServerHandle } from '../src/types';
import { RestNetUtil } from '../src/util/net';

/**
 * Run a rest server as an application
 */
@CliCommand({ runTarget: true, addModule: true, addEnv: true })
export class RunRestCommand implements CliCommandShape {

  /** IPC debug is enabled */
  debugIpc?: boolean;

  /** Should the server be able to run with restart*/
  canRestart?: boolean;

  /** Port to run on */
  port?: number;

  /** Kill conflicting port owner */
  killConflict?: boolean;

  preMain(): void {
    if (this.port) {
      process.env.REST_PORT = `${this.port}`;
    }
  }

  async main(): Promise<ServerHandle | void> {
    if (await CliUtil.debugIfIpc(this) || await CliUtil.runWithRestart(this)) {
      return;
    }
    const { RestApplication } = await import('../src/application/rest.js');
    try {
      return await DependencyRegistry.runInstance(RestApplication);
    } catch (err) {
      if (RestNetUtil.isInuseError(err) && !Env.production && this.killConflict) {
        await RestNetUtil.freePort(err.port);
        return await DependencyRegistry.runInstance(RestApplication);
      }
      throw err;
    }
  }
}