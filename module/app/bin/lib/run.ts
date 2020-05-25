import { CliUtil } from '@travetto/cli/src/util';

import { AppListManager } from './list';
import { ApplicationParameter } from '../../src/types';

/**
 * Supporting app execution
 */
export class RunUtil {

  /**
   * Get the choices or type for a parameter
   */
  static getParamType(config: ApplicationParameter) {
    return (config.meta && config.meta.choices) ? config.meta.choices.join('|') : config.type!;
  }

  /**
   * Execute running of an application, by name.  Setting important environment variables before
   * loading framework and compiling
   */
  static async run(name: string, ...sub: string[]) {
    const app = await AppListManager.findByName(name);

    if (!app) {
      throw new Error(`'Unknown application ${name}`);
    }

    // Init env
    CliUtil.initAppEnv({ app: app.appRoot, watch: app.watchable });

    // Compile all code as needed
    const { PhaseManager, ConsoleManager } = await import('@travetto/base');

    // Pause outputting
    const events: [any, any][] = [];
    ConsoleManager.set({ invoke(a, b) { events.push([a, b]); } });

    await PhaseManager.init('require-all');

    // Load app if in support folder
    if (app.filename.includes('support')) {
      const mod = app.filename.replace(/.*node_modules\//, '');
      require(mod);
    }

    // Finish registration
    await PhaseManager.initAfter('require-all');

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');
    await ApplicationRegistry.resolveParameters(app, sub);

    // Output on success
    ConsoleManager.clear();
    events.forEach(([a, b]) => ConsoleManager.invoke(a, ...b));

    await ApplicationRegistry.run(name, sub);
  }
}