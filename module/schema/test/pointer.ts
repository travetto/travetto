import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Schema } from '../src/decorator/schema.ts';
import { SpecialType } from './models/pointer.ts';
import { SchemaValidator } from '../src/validate/validator.ts';
import { ValidationResultError } from '../src/validate/error.ts';

@Schema()
class Custom {
  pointer: SpecialType;
}

@Suite()
class PointerSuite {

  @BeforeAll()
  ready() {
    return RootRegistry.init();
  }

  @Test()
  testBind() {
    assert(Custom.from({ pointer: '5' }).pointer === '5');
    assert(Custom.from({ pointer: 5 }).pointer === 5);
    assert(Custom.from({ pointer: true }).pointer === true);
    // @ts-ignore
    assert(Custom.from({ pointer: new Date() }).pointer instanceof Date);
    // @ts-ignore
    assert(Custom.from({ pointer: false }).pointer === false);
  }

  @Test()
  async testValidate() {
    try {
      // @ts-ignore
      await SchemaValidator.validate(Custom, Custom.from({ pointer: false }));
      assert(false);
    } catch (err) {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors[0].kind === 'type');
    }

    try {
      await SchemaValidator.validate(Custom, Custom.from({ pointer: 1000 }));
      assert(false);
    } catch (err) {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors[0].kind === 'maxlength');
    }

    try {
      await SchemaValidator.validate(Custom, Custom.from({}));
      assert(false);
    } catch (err) {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors[0].kind === 'required');
    }

    await assert.doesNotReject(async () => {
      await SchemaValidator.validate(Custom, Custom.from({ pointer: 100 }));
      await SchemaValidator.validate(Custom, Custom.from({ pointer: true }));
      await SchemaValidator.validate(Custom, Custom.from({ pointer: 'hello' }));
    });
  }
}