import { EnvUtil, FsUtil } from '@travetto/boot';
import { AppManifest, ShutdownManager } from '@travetto/base';
import { ConfigManager } from '@travetto/config';
import { Class } from '@travetto/registry';
import { DependencyRegistry, InjectionError } from '@travetto/di';

import { ApplicationConfig } from './types';
import { AppUtil } from './util';

/**
 * Registration point for all applications.  Generally invoked by using
 * the `@Application` decorator, but can be used directly as well.
 */
class $ApplicationRegistry {
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
    console.log('Running application', {
      name: config.name,
      filename: config.filename.replace(/^.*node_modules\//, '').replace(FsUtil.cwd, '.')
    });
    console.log('Configured', {
      app: AppManifest.toJSON(),
      config: EnvUtil.isProd() ? ConfigManager.getSecure() : ConfigManager.get()
    });
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
      throw new InjectionError(`Application not found`, { ᚕid: name } as Class<any>);
    }

    const typed = this.resolveParameters(config, args);

    // Fetch instance of app class
    const inst = await DependencyRegistry.getInstance(config.target!);

    this.logInit(config);

    const ret = await inst.run(...typed);
    const target = ret ?? inst;

    if (target) {
      if ('close' in target) {
        ShutdownManager.onShutdown(target); // Tie shutdown into app close
      }
      if ('wait' in target) {
        await target.wait(); // Wait for close signal
      }
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