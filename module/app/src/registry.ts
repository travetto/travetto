import { Env, AppInfo } from '@travetto/base';
import { ConfigSource } from '@travetto/config';
import { DependencyRegistry, InjectionError } from '@travetto/di';

import { ApplicationConfig } from './types';
import { AppUtil } from './util';

/**
 * Registration point for all applications.  Generally invoked by using
 * the `@Application` decorator, but can be used directly as well.
 */
export class $ApplicationRegistry {
  private applications = new Map<string, ApplicationConfig>();

  register(app: string, config: ApplicationConfig) {
    this.applications.set(app, config);
  }

  getAll() {
    return Array.from(this.applications.values());
  }

  /**
   * Runs the application, by name
   */
  async run(name: string, args: string[]) {
    const config = this.applications.get(name);
    if (!config) {
      throw new InjectionError(`Application: ${name} does not exist`, 'notfound');
    }

    // Fetch instance of app class
    const inst = await DependencyRegistry.getInstance(config.target);

    if (!Env.quietInit) {
      console.log('Running application', name);

      console.log('Configured', {
        app: AppInfo,
        env: Env.toJSON(),
        config: Env.prod ? ConfigSource.getSecure() : ConfigSource.get()
      });
    }

    // If run command exists on app
    if (inst.run) {
      const appParams = config.params ?? [];
      const typed = args.map((x, i) => appParams[i] === undefined ? x : AppUtil.enforceParamType(appParams[i], x));
      const reqCount = appParams.filter(x => !x.optional).length;
      if (typed.length < reqCount) {
        throw new Error(`Invalid parameter count: received ${typed.length} but needed ${reqCount}`);
      }

      const ret = await inst.run(...typed);
      const target = ret ?? inst;
      if (AppUtil.isHandle(target)) { // If response is a listener
        await AppUtil.processHandle(target); // Wait for app to finish
      }
    }
    if (!config.watchable) {
      setTimeout(() => process.exit(0), 10).unref(); // Kill if not already dead
    }
  }

  /**
   * Clear all apps on reset
   */
  onReset() {
    this.applications.clear();
  }
}

export const ApplicationRegistry = new $ApplicationRegistry();