import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Validate } from '../src/decorator/schema';
import { ValidationResultError } from '../src/validate/error';

export class CoolGuy {

  @Validate()
  doSomething(name: 'red' | 'green', age: number, color?: string) {
    return `${name}.${age}.${color ?? ''}`;
  }
}

@Suite()
class EdgeCases {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async testMethodInvocation() {
    assert(new CoolGuy().doSomething('green', 20) === 'green.20.');
    // @ts-expect-error
    assert.throws(() => new CoolGuy().doSomething('orange', 20), ValidationResultError);
  }
}