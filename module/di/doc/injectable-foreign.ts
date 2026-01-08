import { EventEmitter } from 'node:events';
import type { Writable } from 'node:stream';

import { Inject, Injectable, InjectableFactory } from '@travetto/di';
import { asFull } from '@travetto/runtime';

class Source {
  @InjectableFactory()
  static emitter(): EventEmitter {
    return new EventEmitter();
  }

  @InjectableFactory(Symbol.for('custom-1'))
  static writable(): Writable {
    return asFull({});
  }

  @InjectableFactory(Symbol.for('custom-2'))
  static writableAlt(): Writable {
    return asFull({});
  }
}

@Injectable()
class Service {
  @Inject()
  emitter: EventEmitter;

  @Inject(Symbol.for('custom-2'))
  writable: Writable;
}