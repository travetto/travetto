import { ObjectUtil, ConsoleListener, ConsoleManager, ConsoleEvent } from '@travetto/base';
import { AutoCreate, DependencyRegistry, Injectable } from '@travetto/di';
import { GlobalTerminal } from '@travetto/terminal';

import { LogEvent, Logger } from './types';
import { LoggerTarget } from './internal/types';
import { CommonLogger } from './common';

/**
 * Logger service
 */
@Injectable()
export class LogService implements ConsoleListener, AutoCreate {

  /**
   * List of all listeners
   */
  #listeners: Logger[] = [];

  async postConstruct(): Promise<void> {
    await GlobalTerminal.init();

    const loggers = DependencyRegistry.getCandidateTypes(LoggerTarget).filter(c => c.class !== CommonLogger);

    // If the user specified logger(s) directly, load them all
    if (loggers.length) {
      const instances = await Promise.all(loggers.map(l => DependencyRegistry.getInstance<Logger>(l.class, l.qualifier)));
      for (const inst of instances) {
        this.#listeners.push(inst);
      }
    } else { // Otherwise fall back to the common logger
      this.#listeners.push(await DependencyRegistry.getInstance(CommonLogger));
    }
    // Take over
    ConsoleManager.set(this, true);
  }

  /**
   * Endpoint for listening, endpoint registered with ConsoleManager
   */
  onLog(ev: ConsoleEvent): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, prefer-const
    let [message, context, ...args] = ev.args as [string, Record<string, unknown>, ...unknown[]];
    if (!ObjectUtil.isPlainObject(context)) {
      args.unshift(context);
      context = {};
    }

    if (typeof message !== 'string') {
      args.unshift(message);
      message = '';
    }

    // Allow for controlled order of event properties
    const finalEvent: LogEvent = {
      ...ev,
      message: message !== '' ? message : undefined,
      context,
      args: args.filter(x => x !== undefined)
    };

    for (const l of this.#listeners) {
      l.onLog(finalEvent);
    }
  }
}