import { PhaseManager, ConsoleManager } from '@travetto/boot';
import { EnvUtil } from '@travetto/base';

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

    if (!EnvUtil.isTrue('TRV_DEBUG')) {
      ConsoleManager.exclude('debug', true);
    }

    // Init
    await PhaseManager.run('init');

    if (!EnvUtil.isTrue('TRV_DEBUG')) {
      ConsoleManager.exclude('debug', false);
    }

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');

    // Convert to full app
    app = typeof app === 'string' ? ApplicationRegistry.getByName(app)! : app;

    return await ApplicationRegistry.run(app.name, sub);
  }
}