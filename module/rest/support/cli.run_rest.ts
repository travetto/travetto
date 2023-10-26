import { DependencyRegistry } from '@travetto/di';
import { CliCommand, CliUtil } from '@travetto/cli';

import { ServerHandle } from '../src/types';

/**
 * Run a rest server as an application
 */
@CliCommand({ runTarget: true, fields: ['module', 'env', 'profile'] })
export class RunRestCommand {

  /** Port to run on */
  port?: number;

  envInit(): Record<string, string | number | boolean> {
    return this.port ? { REST_PORT: `${this.port}` } : {};
  }

  async main(): Promise<ServerHandle | void> {
    if (await CliUtil.runAsRestartable()) {
      return;
    }

    const { RestApplication } = await import('../src/application/rest.js');
    return DependencyRegistry.runInstance(RestApplication);
  }
}