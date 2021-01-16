import { CliUtil } from '@travetto/cli/src/util';
import { CompileCliUtil } from '@travetto/compiler/bin/lib';

import { CliAppListUtil } from './list';
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
    const app = await CliAppListUtil.findByName(name);

    if (!app) {
      throw new Error(`Unknown application ${name}`);
    }

    CliUtil.initAppEnv({ watch: true });

    await CompileCliUtil.compile();

    // Compile all code as needed
    const { PhaseManager, ConsoleManager } = await import('@travetto/base');

    await PhaseManager.init('@trv:compiler/load');

    // Pause outputting
    const events: [string, { line: number, file: string }, (string | number | Error | Date | object)[]][] = [];
    ConsoleManager.set({ onLog: (a, b, c) => events.push([a, b, c]) });

    // Finish registration
    await PhaseManager.initAfter('@trv:compiler/load');

    // And run
    const { ApplicationRegistry } = await import('../../src/registry');
    await ApplicationRegistry.resolveParameters(app, sub);

    // Output on success
    ConsoleManager.clear();
    events.forEach(([a, b, c]) => ConsoleManager.invoke(a as 'debug', b, ...c));

    return await ApplicationRegistry.run(name, sub);
  }
}