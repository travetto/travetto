import { PathUtil } from '@travetto/boot';
import { Class, AppManifest, ShutdownManager, ConcreteClass } from '@travetto/base';
import { DependencyRegistry, InjectionError } from '@travetto/di';
import { SchemaRegistry, SchemaValidator } from '@travetto/schema';
import { ConfigManager } from '@travetto/config';

import { AppClass, ApplicationConfig } from './types';

/**
 * Registration point for all applications.  Generally invoked by using
 * the `@Application` decorator, but can be used directly as well.
 */
class $ApplicationRegistry {
  #applications = new Map<string, ApplicationConfig>();

  register(app: string, config: ApplicationConfig): void {
    this.#applications.set(app, config);
  }

  /**
   * Get application by name
   */
  getByName(name: string): ApplicationConfig | undefined {
    return this.#applications.get(name);
  }

  /**
   * Get all applications
   */
  getAll(): ApplicationConfig[] {
    return Array.from(this.#applications.values());
  }

  /**
   * Prepare parameters for usage
   */
  prepareParams(name: string, args: string[]): unknown[] {
    const config = this.#applications.get(name)!;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cleaned = SchemaRegistry.coerceMethodParams(config.target! as Class, 'run', args);
    SchemaValidator.validateMethod(config.target!, 'run', cleaned);
    return cleaned;
  }

  /**
   * Runs the application, by name
   */
  async run(name: string, args: string[]): Promise<void> {
    const config = this.#applications.get(name);
    if (!config) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      throw new InjectionError('Application not found', { ᚕid: name } as Class);
    }

    const cleaned = this.prepareParams(name, args);

    console.log('Running application', {
      name: config.name,
      filename: PathUtil.simplifyPath(config.filename, '.')
    });

    // Show manifest
    console.log('Manifest', AppManifest.toJSON());

    // Get instance of app class
    const inst = DependencyRegistry.get(config.target!) ?
      await DependencyRegistry.getInstance(config.target!) :
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      new (config.target! as ConcreteClass<AppClass>)();

    // Show config
    console.log('Config', ConfigManager.toJSON());

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
  onReset(): void {
    this.#applications.clear();
  }
}

export const ApplicationRegistry = new $ApplicationRegistry();