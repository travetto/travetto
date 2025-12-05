import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Registry } from '@travetto/registry';

@Suite()
export class RegistryTest {

  @Test()
  async reloadTest() {
    Registry.onMethodChange(e => {
      console.log('Method changed', { type: e.type, target: ('current' in e ? e.current : e.previous) });
    });

    console.log('hi');

    assert(true);
  }
}
