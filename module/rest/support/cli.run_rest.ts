import { DependencyRegistry } from '@travetto/di';
import { CliCommand } from '@travetto/cli';

import { RestApplication } from '../src/application/rest';
import { ServerHandle } from '../src/types';

/**
 * Run a rest server as an application
 */
@CliCommand({ fields: ['module', 'env', 'profile'] })
export class RunRestCommand {

  /** Port to run on */
  port?: number;

  envInit(): Record<string, string | number | boolean> {
    return this.port ? { REST_PORT: `${this.port}` } : {};
  }

  main(): Promise<ServerHandle> {
    return DependencyRegistry.runInstance(RestApplication);
  }
}