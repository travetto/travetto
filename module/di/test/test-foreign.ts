import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { DefaultContextExtends, HttpError } from 'koa';

import { Suite, Test } from '@travetto/test';

import { DependencyRegistry } from '../src/registry';
import { Inject, Injectable, InjectableFactory } from '../__index__';

class Item {
  follow: number;
}

type HttpErrorType = ReturnType<typeof HttpError>;

class Source {
  @InjectableFactory()
  static opts(): HttpErrorType {
    return { message: '', name: '', status: 5, statusCode: 5, expose: false };
  }

  @InjectableFactory()
  static extends(): DefaultContextExtends {
    return { follow: 2 };
  }

  @InjectableFactory()
  static async factory0(opts: HttpErrorType): Promise<Item> {
    const item = new Item();
    item.follow = opts.statusCode;
    return item;
  }

  @InjectableFactory()
  static factory(): EventEmitter {
    return new EventEmitter();
  }

  @InjectableFactory(Symbol.for('custom-1'))
  static writable(): Writable {
    return { writable: false } as Writable;
  }

  @InjectableFactory(Symbol.for('custom-2'))
  static async writableAlt(): Promise<Writable> {
    return { writable: true } as Writable;
  }

}

@Injectable()
class Child {
  @Inject()
  db: EventEmitter;

  @Inject()
  item: Item;

  @Inject(Symbol.for('custom-1'))
  stream: Writable;

  @Inject(Symbol.for('custom-2'))
  stream2: Writable;

  @Inject()
  ctx: DefaultContextExtends;
}

@Suite()
class ForeignTest {

  @Test()
  async testSetter() {
    await DependencyRegistry.init();
    const inst = await DependencyRegistry.getInstance(Child);
    assert(inst.db);
    assert(inst.stream);
    assert(inst.item);
    assert(inst.item.follow);
    assert(inst.item.follow === 5);
    assert(inst.ctx);
    assert(inst.stream.writable === false);
    assert(inst.stream2.writable === true);
  }
}
