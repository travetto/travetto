import { ConsoleListener, ConsoleManager, ConsoleEvent, toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex, Injectable } from '@travetto/di';

import { LogDecorator, LogEvent, Logger } from './types.ts';
import { CommonLogger } from './common.ts';

/**
 * Logger service
 */
@Injectable({ autoInject: true })
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
    this.#listeners = await DependencyRegistryIndex.getInstances(toConcrete<Logger>(), c => c.class !== CommonLogger);
    if (!this.#listeners.length) {
      this.#listeners = [await DependencyRegistryIndex.getInstance(CommonLogger)];
    }

    this.#decorators = await DependencyRegistryIndex.getInstances(toConcrete<LogDecorator>());

    ConsoleManager.set(this);
  }

  /**
   * Endpoint for listening, endpoint registered with ConsoleManager
   */
  log(event: ConsoleEvent): void {
    const args = [...event.args];
    let message: string | undefined;
    if (typeof args[0] === 'string') {
      message = args[0];
      args.shift(); // First arg is now the message
    }

    // Allow for controlled order of event properties
    let outEvent: LogEvent = { ...event, message, args };

    // Decorate event as needed
    for (const d of this.#decorators) {
      outEvent = d.decorate(outEvent);
    }

    for (const l of this.#listeners) {
      l.log(outEvent);
    }
  }
}