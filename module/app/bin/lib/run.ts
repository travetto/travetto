import { CliUtil } from '@travetto/cli/src/util';

import { FindUtil } from './find';
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
    const app = await FindUtil.findByName(name);

    if (!app) {
      throw new Error(`'Unknown application ${name}`);
    }

    // Init env
    CliUtil.initAppEnv({ app: app.appRoot, watch: app.watchable });

    // Compile all code as needed
    const { PhaseManager } = await import('@travetto/base');
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
    await ApplicationRegistry.run(name, sub);
  }
}