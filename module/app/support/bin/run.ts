import { RootRegistry } from '@travetto/registry';
import { RootIndex } from '@travetto/manifest';
import { Env, ExecUtil, ConsoleManager } from '@travetto/base';
import { CliModuleUtil } from '@travetto/cli';

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

    if (CliModuleUtil.isMonoRepoRoot() && app.moduleName) {
      await ExecUtil.spawn(
        'trv',
        ['run', app.name, ...sub],
        {
          cwd: RootIndex.getModule(app.module)!.source,
          env: { TRV_MANIFEST: '' },
          stdio: 'inherit'
        }
      ).result;
      return;
    }

    if (!Env.isTrue('DEBUG')) {
      ConsoleManager.setDebug(false);
    }
    // Init
    await RootRegistry.init();

    if (!Env.isTrue('DEBUG')) {
      ConsoleManager.setDebugFromEnv();
    }

    // Convert to full app
    app = typeof app === 'string' ? ApplicationRegistry.getByName(app)! : app;

    // Run
    return await ApplicationRegistry.run(app.name, sub);
  }
}