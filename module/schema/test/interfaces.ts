import assert from 'node:assert';
import { Readable } from 'node:stream';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RegistryV2 } from '@travetto/registry';
import { Schema, SchemaRegistryIndex, SchemaValidator, ValidationError, ValidationResultError } from '@travetto/schema';

import { Address2 } from './models/address.ts';

function findError(errors: ValidationError[] | undefined, path: string, message: string) {
  return errors?.find(x => x.path === path && x.message.includes(message));
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
  image?: Readable;
}

@Suite()
class ViewsTest {

  @BeforeAll()
  ready() {
    return RegistryV2.init();
  }

  @Test()
  async testRegister() {
    assert(SchemaRegistryIndex.getFieldMap(User).address.type);
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
      assert(findError(err.details.errors, 'address', 'is required'));
    }

    r = User.from({ address: {} });

    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.details.errors, 'address.street1', 'is required'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'c' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.details.errors, 'address.mode', 'is only allowed to be'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'b' }, address2: { mode: 'a' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.details.errors, 'address2.mode', 'is only allowed to be'));
    }

    // @ts-expect-error
    r = User.from({ address: { street1: 'a', mode: 'b' }, address3: { poBox: 'green' } });
    try {
      await SchemaValidator.validate(User, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.details.errors, 'address3.poBox', 'number'));
    }
  }
}