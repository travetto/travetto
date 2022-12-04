import { RootRegistry } from '@travetto/registry';
import { ConsoleManager, ModuleIndex } from '@travetto/boot';
import { Env, ExecUtil } from '@travetto/base';
import { CliModuleUtil } from '@travetto/cli';

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
    const selected = typeof app === 'string' ? app : app.name;

    if (CliModuleUtil.isMonoRepoRoot() && selected.includes(':')) {
      const [mod, name] = selected.split(':');
      await ExecUtil.spawn(
        'trv',
        ['run', name, ...sub],
        {
          cwd: ModuleIndex.getModule(mod)!.source,
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