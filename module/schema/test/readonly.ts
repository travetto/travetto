import assert from 'node:assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { ReadonlyUser } from './models/readonly.ts';

@Suite('Readonly')
class ReadonlySuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
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