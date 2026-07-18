import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { ReadonlyUser } from './models/readonly.ts';

@Suite('Readonly')
class ReadonlySuite {
  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test('Validate bind')
  validateBind() {
    const person = ReadonlyUser.from({
      name: 'Test',
      profile: {
        age: 20
      }
    });

    assert(person.name === undefined);
    assert(person.profile === undefined);
  }
}
