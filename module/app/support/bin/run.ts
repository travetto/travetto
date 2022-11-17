import { RootRegistry } from '@travetto/registry';
import { ConsoleManager } from '@travetto/boot';
import { Env } from '@travetto/base';

import { ApplicationRegistry } from '../../src/registry';
import type { ApplicationConfig } from '../../src/types';

/**
 * Supporting app execution
 */
export class AppRunUtil {

  /**
   * Execute running of an application, by name.  Setting important environment variables before
   * loading framework and compiling
   */
  static async run(app: ApplicationConfig | string, ...sub: string[]): Promise<void> {

    if (!Env.isTrue('TRV_DEBUG')) {
      ConsoleManager.setDebug(false);
    }

    // Init
    await RootRegistry.init();

    if (!Env.isTrue('TRV_DEBUG')) {
      ConsoleManager.setDebug(Env.get('TRV_DEBUG', ''));
    }

    // Convert to full app
    app = typeof app === 'string' ? ApplicationRegistry.getByName(app)! : app;

    // Run
    return await ApplicationRegistry.run(app.name, sub);
  }
}