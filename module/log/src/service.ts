import { ConsoleListener, ConsoleManager, ConsoleEvent, toConcrete } from '@travetto/runtime';
import { DependencyRegistry, Injectable } from '@travetto/di';

import { LogDecorator, LogEvent, Logger } from './types.ts';
import { CommonLogger } from './common.ts';

/**
 * Logger service
 */
@Injectable({ autoCreate: true })
export class LogService implements ConsoleListener {

  /**
   * Log listeners
   */
  #listeners: Logger[] = [];

  /**
   * Log decorators
   */
  #decorators: LogDecorator[] = [];

  async postConstruct(): Promise<void> {
    this.#listeners = await DependencyRegistry.getCandidateInstances(toConcrete<Logger>(), c => c.class !== CommonLogger);
    if (!this.#listeners.length) {
      this.#listeners = [await DependencyRegistry.getInstance(CommonLogger)];
    }

    this.#decorators = await DependencyRegistry.getCandidateInstances(toConcrete<LogDecorator>());

    ConsoleManager.set(this);
  }

  /**
   * Endpoint for listening, endpoint registered with ConsoleManager
   */
  log(ev: ConsoleEvent): void {
    const args = [...ev.args];
    let message: string | undefined;
    if (typeof args[0] === 'string') {
      message = args[0];
      args.shift(); // First arg is now the message
    }

    // Allow for controlled order of event properties
    let outEvent: LogEvent = { ...ev, message, args };

    // Decorate event as needed
    for (const d of this.#decorators) {
      outEvent = d.decorate(outEvent);
    }

    for (const l of this.#listeners) {
      l.log(outEvent);
    }
  }
}