import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliUtil } from '@travetto/cli';
import { GlobalEnv } from '@travetto/base';

import { ServerHandle } from '../src/types';

/**
 * Run a rest server as an application
 */
@CliCommand({ runTarget: true, fields: ['module', 'env'] })
export class RunRestCommand {

  /** IPC debug is enabled */
  debugIpc = true;

  /** Should the server be able to run with restart*/
  canRestart = GlobalEnv.devMode;

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