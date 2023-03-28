import assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Schema } from '../src/decorator/schema';
import { SchemaRegistry } from '../src/service/registry';
import { SchemaValidator } from '../src/validate/validator';
import { ValidationError } from '../src/validate/types';
import { AllViewⲐ } from '../src/internal/types';
import { ValidationResultError } from '../src/validate/error';

import { Address2 } from './models/address';

function findError(errors: ValidationError[], path: string, message: string) {
  return errors.find(x => x.path === path && x.message.includes(message));
}
interface Address {
  street1: string;
  street2?: string;
  mode?: 'a' | 'b';
}

type Address3 = {
  poBox: number;
};

@Schema()
class User {
  address: Address;
  address2?: Address2;
  address3?: Address3;
}

@Suite()
class ViewsTest {

  @BeforeAll()
  ready() {
    return RootRegistry.init();
  }

  @Test()
  async testRegister() {
    assert(SchemaRegistry.get(User).views[AllViewⲐ].schema.address.type);
  }

  @Test('Url and message')
  async urlAndMessage() {
    let r = User.from({});

    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.errors, 'address', 'is required'));
    }

    r = User.from({ address: {} });

    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.errors, 'address.street1', 'is required'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'c' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.errors, 'address.mode', 'is only allowed to be'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'b' }, address2: { mode: 'a' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.errors, 'address2.mode', 'is only allowed to be'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'b' }, address3: { poBox: 'green' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.errors, 'address3.poBox', 'number'));
    }
  }
}