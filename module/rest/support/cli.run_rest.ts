import { ApplicationRegistry } from '@travetto/app';
import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootIndex } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { ValidationError } from '@travetto/schema';

import { RestApplication } from '../src/application/rest';

/**
 * Run a rest server as an application
 */
@CliCommand()
export class RunRestCommand {

  /** Application environment */
  env?: string;

  /** Additional application profiles */
  profile: string[] = [];

  /** Module to run for */
  module?: string;

  /** Port to run on */
  port?: number;

  envInit(): GlobalEnvConfig {
    return {
      debug: process.env.DEBUG || false,
      envName: this.env,
      profiles: this.profile,
      set: this.port ? { REST_PORT: `${this.port}` } : {}
    };
  }

  async validate(): Promise<ValidationError | undefined> {
    if (!this.module && RootIndex.manifest.monoRepo && RootIndex.mainModule.sourcePath === RootIndex.manifest.workspacePath) {
      return {
        kind: 'required',
        path: 'module',
        message: 'Module is a required flag when running from a monorepo root'
      };
    }
  }

  async main(): Promise<void> {
    if (this.module && this.module !== RootIndex.mainModule.name) { // Mono-repo support
      RootIndex.reinitForModule(this.module); // Reinit with specified module
    }
    await RootRegistry.init();
    await ApplicationRegistry.initMessage();
    const instance = await DependencyRegistry.getInstance(RestApplication);
    return ApplicationRegistry.run(await instance.run());
  }
}