import { PathUtil } from '@travetto/boot';
import { Class, AppManifest, ShutdownManager, ConcreteClass } from '@travetto/base';
import { ConfigManager } from '@travetto/config';
import { DependencyRegistry, InjectionError } from '@travetto/di';
import { SchemaRegistry, SchemaValidator } from '@travetto/schema';

import { AppClass, ApplicationConfig } from './types';

/**
 * Registration point for all applications.  Generally invoked by using
 * the `@Application` decorator, but can be used directly as well.
 */
class $ApplicationRegistry {
  #applications = new Map<string, ApplicationConfig>();

  register(app: string, config: ApplicationConfig) {
    this.#applications.set(app, config);
  }

  /**
   * Get application by name
   */
  getByName(name: string) {
    return this.#applications.get(name);
  }

  /**
   * Get all applications
   */
  getAll() {
    return Array.from(this.#applications.values());
  }

  /**
   * Log app init
   */
  logInit(config: ApplicationConfig) {

    // Log startup
    console.log('Running application', {
      name: config.name,
      filename: config.filename.replace(/^.*node_modules\//, '').replace(PathUtil.cwd, '.')
    });
    console.log('Configured', {
      ...AppManifest.toJSON(),
      config: AppManifest.prod ? ConfigManager.getSecure() : ConfigManager.get()
    });
  }

  /**
   * Prepare parameters for usage
   */
  prepareParams(name: string, args: string[]) {
    const config = this.#applications.get(name)!;
    const cleaned = SchemaRegistry.coereceMethodParams(config.target! as Class, 'run', args);
    SchemaValidator.validateMethod(config.target!, 'run'!, cleaned);
    return cleaned;
  }

  /**
   * Runs the application, by name
   */
  async run(name: string, args: string[]) {
    const config = this.#applications.get(name);
    if (!config) {
      throw new InjectionError('Application not found', { ᚕid: name } as Class);
    }

    const cleaned = this.prepareParams(name, args);

    // Get instance of app class
    const inst = DependencyRegistry.get(config.target!) ?
      await DependencyRegistry.getInstance(config.target!) :
      new (config.target! as ConcreteClass<AppClass>)();

    this.logInit(config);

    const ret = await inst.run(...cleaned);

    const target = ret ?? inst;

    if (target) {
      if ('close' in target) {
        ShutdownManager.onShutdown(target); // Tie shutdown into app close
      }
      if ('wait' in target) {
        await target.wait(); // Wait for close signal
      } else if ('on' in target) {
        await new Promise<void>(res => target.on('close', res));
      }
    }
  }

  /**
   * Clear all apps on reset
   */
  onReset() {
    this.#applications.clear();
  }
}

export const ApplicationRegistry = new $ApplicationRegistry();