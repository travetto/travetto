import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { HttpError } from 'http-errors';
import type debug from 'debug';

import { Suite, Test } from '@travetto/test';
import { castTo } from '@travetto/runtime';
import { DependencyRegistryIndex, Inject, Injectable, InjectableFactory } from '@travetto/di';
import { Registry } from '@travetto/registry';

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
  static extends(): debug.Debug {
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
  ctx: debug.Debug;
}

@Suite()
class ForeignTest {

  @Test()
  async testSetter() {
    await Registry.init();
    const inst = await DependencyRegistryIndex.getInstance(Child);
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
