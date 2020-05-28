import * as util from 'util';

import { EnvUtil } from '@travetto/boot';
import { AppManifest } from '@travetto/base';
import { ConfigManager } from '@travetto/config';
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
   * Log app init
   */
  logInit(config: ApplicationConfig) {

    // Log startup
    console.log('Running application', config.name, config.filename);
    console.log(`Configured`, util.inspect({
      app: AppManifest.toJSON(),
      config: EnvUtil.isProd() ? ConfigManager.getSecure() : ConfigManager.get()
    }, false, 10, true));
  }

  /**
   * Resolve parameters against the config
   */
  resolveParameters(config: ApplicationConfig, args: string[]) {
    const appParams = config.params ?? [];
    const typed = args.map((x, i) => appParams[i] === undefined ? x : AppUtil.enforceParamType(appParams[i], x));
    const reqCount = appParams.filter(x => !x.optional).length;
    if (typed.length < reqCount) {
      throw new Error(`Invalid parameter count: received ${typed.length} but needed ${reqCount}`);
    }
    return typed;
  }

  /**
   * Runs the application, by name
   */
  async run(name: string, args: string[]) {
    const config = this.applications.get(name);
    if (!config) {
      throw new InjectionError(`Application: ${name} does not exist`, 'notfound');
    }

    const typed = this.resolveParameters(config, args);

    // Fetch instance of app class
    const inst = await DependencyRegistry.getInstance(config.target);

    this.logInit(config);

    const ret = await inst.run(...typed);
    const target = ret ?? inst;
    if (AppUtil.isHandle(target)) { // If response is a listener
      await AppUtil.processHandle(target); // Wait for app to finish
    } else if (config.watchable) {
      setTimeout(() => process.exit(0), Number.MAX_SAFE_INTEGER / 10 ** 7);
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