import { ApplicationConfig, ApplicationParameter } from '../../src/types';

/**
 * Supporting app execution
 */
export class AppRunUtil {

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
  static async run(app: ApplicationConfig | string, ...sub: string[]) {

    const { PhaseManager, ConsoleManager } = await import('@travetto/base');

    ConsoleManager.exclude('debug', true);

    // Init
    await PhaseManager.run('init');

    ConsoleManager.exclude('debug', false);

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');

    // Convert to full app
    app = typeof app === 'string' ? ApplicationRegistry.getByName(app)! : app;

    await ApplicationRegistry.resolveParameters(app, sub);

    return await ApplicationRegistry.run(app.name, sub);
  }
}