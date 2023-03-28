import { EventEmitter } from 'events';
import { Writable } from 'stream';

import { Inject, Injectable, InjectableFactory } from '@travetto/di';

class Source {
  @InjectableFactory()
  static emitter(): EventEmitter {
    return new EventEmitter();
  }

  @InjectableFactory(Symbol.for('custom-1'))
  static writable(): Writable {
    return {} as Writable;
  }

  @InjectableFactory(Symbol.for('custom-2'))
  static writableAlt(): Writable {
    return {} as Writable;
  }
}

@Injectable()
class Service {
  @Inject()
  emitter: EventEmitter;

  @Inject(Symbol.for('custom-2'))
  writable: Writable;
}