import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { Registry, MethodSource, RootRegistry } from '../';

class Simple extends Registry {
}

@Suite()
export class RegistryTest {

  @Test()
  async reloadTest() {
    const SimpleRegistry = new Simple();

    const MethodListener = new MethodSource(RootRegistry);

    MethodListener.on(e => {
      console.log('Method changed', { type: e.type, target: (e.curr ?? e.prev) });
    });

    console.log('hi');

    assert(true);
  }
}
