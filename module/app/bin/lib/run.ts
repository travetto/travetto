import { Util } from '@travetto/base/src/util';

import { AppListUtil } from './app-list';
import { handleFailure } from './util';
import { ApplicationParameter } from '../../src/types';

export class RunUtil {

  static getParamType(config: ApplicationParameter) {
    return (config.meta && config.meta.choices) ? config.meta.choices.join('|') : config.type!;
  }

  static enforceParamType(config: ApplicationParameter, param: string) {
    switch (config.type) {
      case 'boolean': return Util.coerceType(param, Boolean);
      case 'number': return Util.coerceType(param, Number);
      default:
        if (config.meta?.choices && !config.meta.choices.find(c => `${c}` === param)) {
          throw new Error(`Invalid parameter ${config.name}: Received ${param} expected ${config.meta.choices.join('|')}`);
        }
        return Util.coerceType(param, String);
    }
  }

  static async run(args: string[]) {
    const name = args[0];
    const [, ...sub] = args;
    const app = await AppListUtil.getByName(name);

    let typedSub: (string | number | boolean | Date)[] = sub;

    if (app) {
      const appParams = app.params ?? [];
      typedSub = sub.map((x, i) => appParams[i] === undefined ? x : this.enforceParamType(appParams[i], x));
      const reqCount = appParams.filter(x => !x.optional).length;
      if (typedSub.length < reqCount) {
        throw new Error(`Invalid parameter count: received ${typedSub.length} but needed ${reqCount}`);
      }

      process.env.APP_ROOTS = process.env.APP_ROOTS ?? app.appRoot ?? '';
      if (!process.env.WATCH) {
        if (/^prod/i.test(`${process.env.ENV}`)) {
          process.env.WATCH = '0';
        } else if (app.watchable !== undefined) {
          process.env.watch = `${app.watchable}`;
        }
      }
    }

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.bootstrap();

    const { ApplicationRegistry } = await import('../../src/registry');
    await ApplicationRegistry.run(name, typedSub);
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