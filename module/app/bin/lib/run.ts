import { AppListUtil } from './app-list';
import { ApplicationParameter } from '../../src/types';
import { handleFailure } from './util';

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
  static async run(args: string[]) {
    const name = args[0];
    const [, ...sub] = args;
    const app = await AppListUtil.getByName(name);

    if (app) {
      process.env.TRV_APP_ROOTS = process.env.TRV_APP_ROOTS ?? app.appRoot ?? '';
      if (!process.env.TRV_WATCH) {
        if (/^prod/i.test(`${process.env.TRV_ENV}`)) {
          process.env.TRV_WATCH = '0';
        } else if (app.watchable !== undefined) {
          process.env.TRV_WATCH = `${app.watchable}`;
        }
      }
    }

    // Compile all code as needed
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init('require-all');

    // Load app if in support folder
    if (app && app.filename.includes('support')) {
      const mod = app.filename.replace(/.*node_modules\//, '');
      require(mod);
    }

    // Finish registration
    await PhaseManager.initAfter('require-all');

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');
    await ApplicationRegistry.run(name, sub);
  }

  static async runDirect() {
    try {
      return this.run(process.argv.slice(2));
    } catch (err) {  // If loaded directly as main entry, run, idx 2 is where non-node arguments start at
      handleFailure(err, 1);
      throw err;
    }
  }
}