import { CompileBinUtil } from '@travetto/compiler/bin/lib';

import { ApplicationConfig, ApplicationParameter } from '../../src/types';

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
  static async run(app: ApplicationConfig | string, ...sub: string[]) {

    await CompileBinUtil.compile();

    const { PhaseManager, ConsoleManager } = await import('@travetto/base');

    ConsoleManager['exclude'].add('debug');

    // Init
    await PhaseManager.run('init');

    ConsoleManager['exclude'].delete('debug');

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');

    // Convert to full app
    app = typeof app === 'string' ? ApplicationRegistry['applications'].get(app)! : app;

    await ApplicationRegistry.resolveParameters(app, sub);

    return await ApplicationRegistry.run(app.name, sub);
  }
}

export function main(app: string, ...args: string[]) {
  return RunUtil.run(app, ...args);
}