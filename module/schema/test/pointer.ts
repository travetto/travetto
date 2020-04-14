import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Schema } from '../';
import { SpecialType } from './models/pointer';
import { SchemaRegistry } from '../src/service/registry';
import { SchemaValidator } from '../src/validate/validator';

@Schema()
class Custom {
  pointer: SpecialType;
}

@Suite()
class PointerSuite {

  @BeforeAll()
  ready() {
    return SchemaRegistry.init();
  }

  @Test()
  testBind() {
    assert(Custom.from({ pointer: '5' }).pointer === '5');
    assert(Custom.from({ pointer: 5 }).pointer === 5);
    assert(Custom.from({ pointer: true }).pointer === true);
    // @ts-ignore
    assert(Custom.fromRaw({ pointer: new Date() }).pointer instanceof Date);
    // @ts-ignore
    assert(Custom.fromRaw({ pointer: false }).pointer === false);
  }

  @Test()
  async testValidate() {
    try {
      await SchemaValidator.validate(Custom.fromRaw({ pointer: false }));
      assert(false);
    } catch (err) {
      assert(err.errors?.[0].kind === 'type');
    }

    try {
      await SchemaValidator.validate(Custom.fromRaw({ pointer: 1000 }));
      assert(false);
    } catch (err) {
      assert(err.errors?.[0].kind === 'maxlength');
    }

    try {
      await SchemaValidator.validate(Custom.fromRaw({}));
      assert(false);
    } catch (err) {
      assert(err.errors?.[0].kind === 'required');
    }

    await assert.doesNotReject(async () => {
      await SchemaValidator.validate(Custom.from({ pointer: 100 }));
      await SchemaValidator.validate(Custom.from({ pointer: true }));
      await SchemaValidator.validate(Custom.from({ pointer: 'hello' }));
    });
  }
}