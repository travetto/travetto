import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RegistryV2 } from '@travetto/registry';

@Suite()
export class RegistryTest {

  @Test()
  async reloadTest() {
    RegistryV2.onMethodChange(e => {
      console.log('Method changed', { type: e.type, target: ('curr' in e ? e.curr : e.prev) });
    });

    console.log('hi');

    assert(true);
  }
}
