import { RootRegistry } from '@travetto/registry';
import { RootIndex } from '@travetto/manifest';
import { Env, ConsoleManager } from '@travetto/base';

import { ApplicationRegistry } from '../../src/registry';
import type { ApplicationConfig } from '../../src/types';
import { AppListLoader } from './list';

/**
 * Supporting app execution
 */
export class AppRunUtil {

  /**
   * Execute running of an application, by name.  Setting important environment variables before
   * loading framework and compiling
   */
  static async run(app: ApplicationConfig | string, ...sub: string[]): Promise<void> {
    if (typeof app === 'string') {
      app = (await new AppListLoader().findByName(app))!;
    }

    if (app.module) {
      RootIndex.reinitForModule(app.module); // Reinit with app
    }

    if (!Env.isTrue('DEBUG')) {
      ConsoleManager.setDebug(false);
    }
    // Init
    await RootRegistry.init();

    if (!Env.isTrue('DEBUG')) {
      ConsoleManager.setDebugFromEnv();
    }

    // Run
    return await ApplicationRegistry.run(app.name, sub);
  }
}