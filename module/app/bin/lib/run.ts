import { CompileCliUtil } from '@travetto/compiler/bin/lib';

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
  static async run(app: ApplicationConfig, ...sub: string[]) {

    await CompileCliUtil.compile();

    const { PhaseManager, ConsoleManager } = await import('@travetto/base');

    // Pause outputting
    const events: [string, { line: number, file: string }, unknown[]][] = [];
    ConsoleManager.set({ onLog: (a, b, c) => events.push([a, b, c]) });

    // Init
    await PhaseManager.init();

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');
    await ApplicationRegistry.resolveParameters(app, sub);

    // Output on success
    ConsoleManager.clear();
    events.forEach(([a, b, c]) => ConsoleManager.invoke(a as 'debug', b, ...c));

    return await ApplicationRegistry.run(app.name, sub);
  }
}