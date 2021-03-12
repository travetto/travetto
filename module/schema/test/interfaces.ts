import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Schema } from '../src/decorator/schema';
import { SchemaRegistry } from '../src/service/registry';
import { ALL_VIEW } from '../src/service/types';
import { SchemaValidator } from '../src/validate/validator';
import { ValidationError } from '../src/validate/types';
import { Address2 } from './models/address';

function findError(errors: ValidationError[], path: string, message: string) {
  return errors.find(x => x.path === path && x.message.includes(message));
}
interface Address {
  street1: string;
  street2?: string;
  mode?: 'a' | 'b';
}

@Schema()
class User {
  address: Address;
  address2?: Address2;
}

@Suite()
class ViewsTest {

  @BeforeAll()
  ready() {
    return RootRegistry.init();
  }

  @Test()
  async testRegister() {
    assert(SchemaRegistry.get(User).views[ALL_VIEW].schema.address.type);
  }

  @Test('Url and message')
  async urlAndMessage() {
    let r = User.from({});

    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (e) {
      console.warn('Validation Failed', { error: e });
      assert(findError(e.errors, 'address', 'is required'));
    }

    r = User.from({ address: {} });

    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (e) {
      console.warn('Validation Failed', { error: e });
      assert(findError(e.errors, 'address.street1', 'is required'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'c' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (e) {
      console.warn('Validation Failed', { error: e });
      assert(findError(e.errors, 'address.mode', 'is only allowed to be'));
    }
  }
}