import { RootIndex } from '@travetto/manifest';
import { ShutdownManager, GlobalEnv, Closeable } from '@travetto/base';
import { DependencyRegistry } from '@travetto/di';
import { Configuration } from '@travetto/config';

import { ApplicationConfig, Waitable } from './types';

/**
 * Registration point for all applications. Generally invoked by using
 * the `@Application` decorator, but can be used directly as well.
 */
class $ApplicationRegistry {
  #applications = new Map<string, ApplicationConfig>();

  async init(): Promise<void> {
    await RootIndex.loadSource();
  }

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

  async initMessage(): Promise<void> {
    // Show manifest
    console.log('Manifest', {
      info: RootIndex.mainDigest(),
      env: GlobalEnv.toJSON()
    });

    const rootConfig = await DependencyRegistry.getInstance(Configuration);

    // Show config
    console.log('Config', await rootConfig.exportActive());
  }

  /**
   * Runs the application, by name
   */
  async run(target: Waitable | Closeable | void | undefined): Promise<void> {

    if (target) {
      if ('close' in target) {
        ShutdownManager.onShutdown(target, target); // Tie shutdown into app close
      }
      if ('wait' in target) {
        await target.wait(); // Wait for close signal
      } else if ('on' in target) {
        await new Promise<void>(res => target.on('close', res));
      }
    }
  }
}

export const ApplicationRegistry = new $ApplicationRegistry();