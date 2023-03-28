import assert from 'assert';
import { Minimatch, IOptions } from 'minimatch';
import { DefaultContextExtends } from 'koa';
import { EventEmitter } from 'events';
import { Writable } from 'stream';

import { Suite, Test } from '@travetto/test';

import { DependencyRegistry } from '../src/registry';
import { Inject, Injectable, InjectableFactory } from '../__index__';

class Source {
  @InjectableFactory()
  static opts(): IOptions {
    return {
      flipNegate: true
    };
  }

  @InjectableFactory()
  static extends(): DefaultContextExtends {
    return {
      flipNegate: false
    };
  }


  @InjectableFactory()
  static factory0(opts: IOptions): Minimatch {
    return new Minimatch('', opts);
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
  match: Minimatch;

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
    assert(inst.match);
    assert(inst.match.makeRe);
    assert(inst.match.options.flipNegate);
    assert(inst.ctx);
    assert(inst.stream.writable === false);
    assert(inst.stream2.writable === true);
  }
}
