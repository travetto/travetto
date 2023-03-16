import { DependencyRegistry } from '@travetto/di';
import { CliCommand } from '@travetto/cli';
import { BaseRunCommand } from '@travetto/registry/support/base.run';

import { RestApplication } from '../src/application/rest';

/**
 * Run a rest server as an application
 */
@CliCommand()
export class RunRestCommand extends BaseRunCommand {

  /** Port to run on */
  port?: number;

  envSet(): Record<string, string | number | boolean> {
    return this.port ? { REST_PORT: `${this.port}` } : {};
  }

  main(): Promise<void> {
    return this.run(async () => {
      const app = await DependencyRegistry.getInstance(RestApplication);
      return app.run();
    });
  }
}