import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliUtil } from '@travetto/cli';

import { ServerHandle } from '../src/types';

/**
 * Run a rest server as an application
 */
@CliCommand({ runTarget: true, addModule: true, addEnv: true })
export class RunRestCommand {

  /** IPC debug is enabled */
  debugIpc?: boolean;

  /** Should the server be able to run with restart*/
  canRestart?: boolean;

  /** Port to run on */
  port?: number;

  envInit(): Record<string, string | number | boolean> {
    return this.port ? { REST_PORT: `${this.port}` } : {};
  }

  async main(): Promise<ServerHandle | void> {
    if (await CliUtil.debugIfIpc(this) || await CliUtil.runWithRestart(this)) {
      return;
    }

    const { RestApplication } = await import('../src/application/rest.js');
    return DependencyRegistry.runInstance(RestApplication);
  }
}