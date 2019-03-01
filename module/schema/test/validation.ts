import * as assert from 'assert';

import { Suite, Test, BeforeAll, ShouldThrow } from '@travetto/test';

import { SchemaValidator, ValidationResultError, SchemaRegistry, ValidationError } from '../';
import {
  Response, Parent, MinTest, Nested, ViewSpecific, Grade, Ccccz, AllAs, Bbbbz, Aaaz,
  CustomValidated, StringMatches, NotRequiredUndefinable, DateTestSchema, Address
} from './models/validation';

function findError(errors: ValidationError[], path: string, message: string) {
  return errors.find(x => x.path === path && x.message.includes(message));
}

@Suite()
class Validation {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
  }

  @Test('Url and message')
  async urlAndMessage() {
    const r = Response.from({
      url: 'htt://google'
    });
    try {
      await SchemaValidator.validate(r);
      assert.fail('Validation should have failed');
    } catch (e) {
      console.log(e);
      assert(findError(e.errors, 'url', 'not a valid url'));
      assert(findError(e.errors, 'timestamp', 'is required'));
    }
  }

  @Test('Should validate nested')
  async nested() {
    const res = Parent.fromRaw({
      response: {
        url: 'a.b',
        pandaState: 'orange'
      },
      responses: []
    });
    try {
      await SchemaValidator.validate(res);
      assert.fail('Validation should have failed');
    } catch (e) {
      if (e instanceof ValidationResultError) {
        assert(findError(e.errors, 'responses', 'required'));
        assert(findError(e.errors, 'response.pandaState', 'TIRED'));
        assert(findError(e.errors, 'response.url', 'not a valid url'));
        assert(findError(e.errors, 'response.timestamp', 'is required'));
      } else {
        throw e;
      }
    }
  }

  @Test('Should ensure message for min')
  @ShouldThrow(ValidationResultError)
  async minMessage() {
    const o = MinTest.from({ value: 'hello' });

    await SchemaValidator.validate(o);
  }

  @Test('Nested validations should be fine')
  async nestedObject() {
    const obj = Nested.from({
      name: 'bob',
      address: {
        street1: 'abc',
        city: 'city',
        zip: 200,
        postal: '55555'
      }
    });

    const o = await SchemaValidator.validate(obj);
    assert(o !== undefined);
  }

  @Test('Nested validations should be fine')
  @ShouldThrow(ValidationResultError)
  async nestedObjectErrors() {
    const obj = Nested.fromRaw({
      name: 5,
      address: {
        street1: 'abc',
        city: 'city',
        zip: 400
      }
    });

    await SchemaValidator.validate(obj);
  }

  @Test('Custom Validators')
  async validateFields() {
    const obj = CustomValidated.from({
      age: 200,
      age2: 10
    });

    try {
      await SchemaValidator.validate(obj);
      assert(false);
    } catch (e) {
      if (e instanceof ValidationResultError) {
        assert(e.errors[0].path === 'age1');
        assert(e.errors[0].kind === 'custom');
        assert(e.errors[0].message === 'age1 + age2 cannot be even');
      } else {
        throw e;
      }
    }
  }

  @Test('Nested view')
  async validateViewsNested() {
    const obj = ViewSpecific.from({
      name: 'bob',
      address: {
        street1: '5',
        zip: 200,
        postal: '55555'
      }
    }, 'profile');

    await SchemaValidator.validate(obj, 'profile');
  }

  @Test('Regex Array')
  async regexArray() {
    const obj = StringMatches.from({
      names: ['abc', 'ac', 'abbbc']
    });

    await SchemaValidator.validate(obj);

    const obj2 = StringMatches.from({
      names: ['bc', 'ab', 'bac']
    });

    await assert.rejects(() =>
      SchemaValidator.validate(obj2)
      , ValidationResultError);
  }

  @Test('manually unrequired')
  async unrequired() {
    const o = NotRequiredUndefinable.from({

    });

    await SchemaValidator.validate(o);
  }

  @Test('date tests')
  async dates() {

    assert.rejects(() => {
      const o = DateTestSchema.fromRaw({ date: '' });
      return SchemaValidator.validate(o);
    }, (err: any) => {
      if (!(err instanceof ValidationResultError && err.errors[0].kind === 'required')) {
        return err;
      }
    });

    assert.rejects(() => {
      const o = DateTestSchema.fromRaw({ date: undefined });
      return SchemaValidator.validate(o);
    }, (err: any) => {
      if (!(err instanceof ValidationResultError && err.errors[0].kind === 'required')) {
        return err;
      }
    });

    assert.rejects(() => {
      const o = DateTestSchema.fromRaw({ date: NaN });
      return SchemaValidator.validate(o);
    }, (err: any) => {
      if (!(err instanceof ValidationResultError && err.errors[0].kind === 'type')) {
        return err;
      }
    });

    assert.rejects(() => {
      const o = CustomValidated.fromRaw({ age: Number.NaN, age2: 1 });
      return SchemaValidator.validate(o);
    }, (err: any) => {
      if (!(err instanceof ValidationResultError && err.errors[0].kind === 'type')) {
        return err;
      }
    });

    assert.rejects(() => {
      const o = CustomValidated.fromRaw({ age: 1, age2: 1 });
      return SchemaValidator.validate(o);
    }, (err: any) => {
      if (!(err instanceof ValidationResultError && err.errors[0].kind === 'custom')) {
        return err;
      }
    });

  }

  @Test()
  async ensureRange() {
    const v = Grade.from({ score: 5 });
    await SchemaValidator.validate(v);
  }

  @Test()
  async verifyMultipleNested() {
    const schema = SchemaRegistry.getViewSchema(Ccccz);
    assert(schema.fields.includes('c'));
    assert(schema.fields.includes('b'));
    assert(schema.fields.includes('a'));
  }

  @Test()
  async verifyNestedPolymorphic() {
    const item = AllAs.fromRaw({
      all: [{
        type: 'bbbbz',
        a: true
      }, {
        type: 'ccccz',
        a: false
      }, {
        type: 'aaaz',
        a: false
      }]
    });

    assert(item.all);
    assert(item.all.length === 3);
    assert(item.all[0] instanceof Bbbbz);
    assert(item.all[1] instanceof Ccccz);
    assert(item.all[2] instanceof Aaaz);

    assert.rejects(async () => {
      await SchemaValidator.validate(item);
    });

    try {
      await SchemaValidator.validate(item);
    } catch (err) {
      if (err instanceof ValidationResultError) {
        assert(err.errors[0].path === 'all[0].b');
        assert(err.errors[0].message === 'all[0].b is required');
        assert(err.errors[1].path === 'all[1].b');
        assert(err.errors[1].message === 'all[1].b is required');
        assert(err.errors[2].path === 'all[1].c');
        assert(err.errors[2].message === 'all[1].c is required');
      } else {
        throw err;
      }
    }
  }

  @Test()
  async verifyOptional() {
    const addr = Address.fromRaw({
      street1: 'street1',
      city: 'city',
      postal: '30000',
      zip: 200
    });

    await assert.doesNotReject(() => SchemaValidator.validate(addr));
    addr.zip = '800' as any;
    await assert.rejects(() => SchemaValidator.validate(addr));
    await assert.rejects(() => SchemaValidator.validatePartial(addr));
    delete addr.zip;
    delete addr.street1;
    await assert.rejects(() => SchemaValidator.validate(addr));
    await assert.doesNotReject(() => SchemaValidator.validatePartial(addr));
  }
}
