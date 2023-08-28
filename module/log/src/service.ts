import { ObjectUtil, ConsoleListener, ConsoleManager, ConsoleEvent } from '@travetto/base';
import { AutoCreate, DependencyRegistry, Injectable } from '@travetto/di';
import { GlobalTerminal } from '@travetto/terminal';

import { LogDecorator, LogEvent, Logger } from './types';
import { LogDecoratorTarget, LoggerTarget } from './internal/types';
import { CommonLogger } from './common';

/**
 * Logger service
 */
@Injectable()
export class LogService implements ConsoleListener, AutoCreate {

  /**
   * Log listeners
   */
  #listeners: Logger[] = [];

  /**
   * Log decorators
   */
  #decorators: LogDecorator[] = [];

  async postConstruct(): Promise<void> {
    await GlobalTerminal.init();

    this.#listeners = await DependencyRegistry.getCandidateInstances<Logger>(LoggerTarget, c => c.class !== CommonLogger);
    if (!this.#listeners.length) {
      this.#listeners = [await DependencyRegistry.getInstance(CommonLogger)];
    }

    this.#decorators = await DependencyRegistry.getCandidateInstances<LogDecorator>(LogDecoratorTarget);

    // Take over
    ConsoleManager.set(this, true);
  }

  /**
   * Endpoint for listening, endpoint registered with ConsoleManager
   */
  onLog(ev: ConsoleEvent): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, prefer-const
    let [message, context, ...args] = ev.args as [string | undefined, Record<string, unknown>, ...unknown[]];
    if (!ObjectUtil.isPlainObject(context)) {
      if (context !== undefined) {
        args.unshift(context);
      }
      context = {};
    }

    if (typeof message !== 'string' && message !== undefined) {
      args.unshift(message);
      message = undefined;
    }

    // Allow for controlled order of event properties
    let outEvent: LogEvent = { ...ev, message, context, args };

    // Decorate event as needed
    for (const d of this.#decorators) {
      outEvent = d.decorate(outEvent);
    }

    for (const l of this.#listeners) {
      l.onLog(outEvent);
    }
  }
}