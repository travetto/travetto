import { CliCommandShape, CliCommand } from '@travetto/cli';
import { GlobalEnvConfig } from '@travetto/base';
import { ValidationError } from '@travetto/schema';

import { AppListLoader } from './bin/list';
import { AppRunUtil } from './bin/run';

/**
 * The main entry point for the application cli
 */
@CliCommand()
export class AppRunCommand implements CliCommandShape {
  #loader: AppListLoader = new AppListLoader();

  /** Application environment */
  env?: string;

  /** Additional application profiles */
  profile: string[] = [];

  envInit(): GlobalEnvConfig {
    return {
      debug: process.env.DEBUG || false,
      envName: this.env,
      profiles: this.profile
    };
  }

  async validate(app: string, ...args: unknown[]): Promise<ValidationError | undefined> {
    // Find app
    const selected = await this.#loader.findByName(app);

    // If app not found
    if (!selected) {
      return {
        message: `${app} is an unknown application`,
        kind: 'required',
        path: 'app'
      };
    }
  }

  /**
   * Main action
   */
  async main(app: string, args: string[]): Promise<void> {
    const selected = await this.#loader.findByName(app);
    return await AppRunUtil.run(selected!, ...args);
  }

  async jsonIpc(app: string, args: string[]): Promise<unknown | undefined> {
    if (!app) {
      return;
    } else {
      return { name: app, args };
    }
  }
}