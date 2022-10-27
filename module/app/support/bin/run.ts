import { PhaseManager, ConsoleManager } from '@travetto/boot';
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
      ConsoleManager.exclude('debug', true);
    }

    // Init
    await PhaseManager.run('init');

    if (!Env.isTrue('TRV_DEBUG')) {
      ConsoleManager.exclude('debug', false);
    }

    // Convert to full app
    app = typeof app === 'string' ? ApplicationRegistry.getByName(app)! : app;

    // Run
    return await ApplicationRegistry.run(app.name, sub);
  }
}