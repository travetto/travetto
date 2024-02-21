import { ConsoleListener, ConsoleManager, ConsoleEvent } from '@travetto/base';
import { AutoCreate, DependencyRegistry, Injectable } from '@travetto/di';

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
    const args = [...ev.args];
    let context: Record<string, unknown> | undefined;
    let message: string | undefined;
    if (typeof args[0] === 'string') {
      message = args[0];
      args.shift(); // First arg is now the message
    }

    // More flexible on context
    const last = args[args.length - 1];
    if (last !== null && last !== undefined && typeof last === 'object') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      context = Object.fromEntries(
        Object.entries(last).filter(x => typeof x[1] !== 'function')
      );
      args.pop();
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