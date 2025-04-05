import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { HttpError } from 'http-errors';
import keygrip from 'keygrip';

import { Suite, Test } from '@travetto/test';
import { castTo } from '@travetto/runtime';

import { DependencyRegistry } from '../src/registry.ts';
import { Inject, Injectable, InjectableFactory } from '../src/decorator.ts';

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
  static extends(): keygrip {
    return castTo({});
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
    return castTo({ writable: false });
  }

  @InjectableFactory(Symbol.for('custom-2'))
  static async writableAlt(): Promise<Writable> {
    return castTo({ writable: true });
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
  ctx: keygrip;
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
