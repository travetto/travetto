import assert from 'node:assert';

import { Suite, Test, BeforeAll, ShouldThrow } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { asFull, castTo } from '@travetto/runtime';
import { SchemaRegistryIndex, SchemaValidator, ValidationError, ValidationResultError } from '@travetto/schema';

import {
  Response, Parent, MinTest, Nested, ViewSpecific, Grade, Ccccz, AllAs, Bbbbz, Aaaaz,
  CustomValidated, StringMatches, NotRequiredUndefinable, DateTestSchema, Address, Opaque, TemplateLit,
  RangeSchema
} from './models/validation.ts';
import { Accessors } from './models/binding.ts';

function findError(errors: ValidationError[], path: string, message: string) {
  return errors.find(x => x.path === path && x.message.includes(message));
}

@Suite()
class Validation {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test('Url and message')
  async urlAndMessage() {
    const r = Response.from({
      url: 'htt://google'
    });
    try {
      await SchemaValidator.validate(Response, r);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      console.warn('Validation Failed', { error: err });
      assert(findError(err.details.errors, 'url', 'not a valid url'));
      assert(findError(err.details.errors, 'timestamp', 'is required'));
    }
  }

  @Test('Should validate nested')
  async nested() {
    const res = Parent.from({
      response: {
        url: 'a.b',
        // @ts-ignore
        pandaState: 'orange'
      },
      responses: []
    });
    try {
      await SchemaValidator.validate(Parent, res);
      assert.fail('Validation should have failed');
    } catch (err) {
      assert(err instanceof ValidationResultError);
      assert(findError(err.details.errors, 'responses', 'required'));
      assert(findError(err.details.errors, 'response.pandaState', 'TIRED'));
      assert(findError(err.details.errors, 'response.url', 'not a valid url'));
      assert(findError(err.details.errors, 'response.timestamp', 'is required'));
    }
  }

  @Test('Should ensure message for min')
  @ShouldThrow(ValidationResultError)
  async minMessage() {
    const o = MinTest.from({ value: 'hello' });

    await SchemaValidator.validate(MinTest, o);
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

    const o = await SchemaValidator.validate(Nested, obj);
    assert(o !== undefined);
  }

  @Test('Nested validations should be fine')
  @ShouldThrow(ValidationResultError)
  async nestedObjectErrors() {
    const obj = Nested.from({
      // @ts-ignore
      name: 5,
      address: {
        street1: 'abc',
        city: 'city',
        // @ts-ignore
        zip: 400
      }
    });

    await SchemaValidator.validate(Nested, obj);
  }

  @Test('Custom Validators')
  async validateFields() {
    const obj = CustomValidated.from({
      age: 200,
      age2: 10
    });

    try {
      await SchemaValidator.validate(CustomValidated, obj);
      assert(false);
    } catch (err) {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors[0].path === 'age1');
      assert(err.details.errors[0].kind === 'custom');
      assert(err.details.errors[0].message === 'age1 + age2 cannot be even');
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

    await SchemaValidator.validate(ViewSpecific, obj, 'profile');
  }

  @Test('Regex Array')
  async regexArray() {
    const obj = StringMatches.from({
      names: ['abc', 'ac', 'abbbc']
    });

    await SchemaValidator.validate(StringMatches, obj);

    const obj2 = StringMatches.from({
      names: ['bc', 'ab', 'bac']
    });

    await assert.rejects(
      () => SchemaValidator.validate(StringMatches, obj2),
      ValidationResultError
    );
  }

  @Test('manually unRequired')
  async unRequired() {
    const o = NotRequiredUndefinable.from({

    });

    await SchemaValidator.validate(NotRequiredUndefinable, o);
  }

  @Test('date tests')
  async dates() {

    await assert.rejects(() => {
      const o = DateTestSchema.from({ date: undefined });
      return SchemaValidator.validate(DateTestSchema, o);
    }, e => e instanceof ValidationResultError && e.details.errors[0].kind === 'required');

    await assert.rejects(() => {
      // @ts-ignore
      const o = DateTestSchema.from({ date: NaN });
      return SchemaValidator.validate(DateTestSchema, o);
    }, e => e instanceof ValidationResultError && e.details.errors[0].kind === 'type');

    await assert.rejects(() => {
      const o = CustomValidated.from({ age: Number.NaN, age2: 1 });
      return SchemaValidator.validate(CustomValidated, o);
    }, e => e instanceof ValidationResultError && e.details.errors[0].kind === 'type');

    await assert.rejects(() => {
      const o = CustomValidated.from({ age: 1, age2: 1 });
      return SchemaValidator.validate(CustomValidated, o);
    }, e => e instanceof ValidationResultError && e.details.errors[0].kind === 'custom');

    await assert.rejects(() => {
      // @ts-ignore
      const o = DateTestSchema.from({ date: '' });
      return SchemaValidator.validate(DateTestSchema, o);
    }, e => e instanceof ValidationResultError && e.details.errors[0].kind === 'required');
  }

  @Test()
  async ensureRange() {
    const v = Grade.from({ score: 5 });
    await SchemaValidator.validate(Grade, v);
  }

  @Test()
  async verifyMultipleNested() {
    const fields = SchemaRegistryIndex.get(Ccccz).getFields();
    assert('c' in fields);
    assert('b' in fields);
    assert('a' in fields);
  }

  @Test()
  async verifyNestedPolymorphic() {
    const item = AllAs.from({
      all: [{
        type: 'bbbbz',
        a: true
      }, {
        type: 'ccccz',
        a: false
      }, {
        type: 'aaaaz',
        a: false
      }]
    });

    assert(item.all);
    assert(item.all.length === 3);
    assert(item.all[0] instanceof Bbbbz);
    assert(item.all[1] instanceof Ccccz);
    assert(item.all[2] instanceof Aaaaz);

    await assert.rejects(() => SchemaValidator.validate(AllAs, item));

    try {
      await SchemaValidator.validate(AllAs, item);
    } catch (err) {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors[0].path === 'all[0].b');
      assert(err.details.errors[0].message === 'all[0].b is required');
      assert(err.details.errors[1].path === 'all[1].b');
      assert(err.details.errors[1].message === 'all[1].b is required');
      assert(err.details.errors[2].path === 'all[1].c');
      assert(err.details.errors[2].message === 'all[1].c is required');
    }
  }

  @Test()
  async verifyOptional() {
    const addr = Address.from({
      street1: 'street1',
      city: 'city',
      postal: '30000',
      zip: 200
    });

    await assert.doesNotReject(() => SchemaValidator.validate(Address, addr));
    // @ts-expect-error
    addr.zip = '800';
    await assert.rejects(() => SchemaValidator.validate(Address, addr));
    await assert.rejects(() => SchemaValidator.validatePartial(Address, addr));
    // @ts-expect-error
    delete addr.zip;
    // @ts-expect-error
    delete addr.street1;
    await assert.rejects(() => SchemaValidator.validate(Address, addr));
    await assert.doesNotReject(() => SchemaValidator.validatePartial(Address, addr));
  }

  // @Test({ skip: false })
  async badValidate() {
    const addr = Address.from({
      city: 'city',
      postal: '30000',
    });

    await SchemaValidator.validate(Address, addr);
  }

  @Test()
  async nestedList() {
    AllAs.from({
      all: [{
        a: false
      }]
    });
  }

  @Test()
  async opaqueChild() {
    const child = Opaque.from({
      name: 'bob',
      details: {
        age: 20
      }
    });

    await SchemaValidator.validate(Opaque, child);
  }

  @Test()
  @ShouldThrow(ValidationResultError)
  async badOpaqueChild() {
    const child = Opaque.from({
      // @ts-expect-error
      name: 5,
      // @ts-expect-error
      age: 'bob',
      details: {
        age: 20
      }
    });

    const validated = await SchemaValidator.validate(Opaque, child);
    assert(validated.name === '5');
  }

  @Test()
  async verifyRawNestedPolymorphic() {
    const item = {
      all: [{
        type: 'bbbbz',
        a: true
      }, {
        type: 'ccccz',
        a: false
      }, {
        type: 'aaaaz',
        a: false
      }]
    };

    await assert.rejects(() => SchemaValidator.validate(AllAs, item), err => {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors[0].path === 'all[0].b');
      assert(err.details.errors[0].message === 'all[0].b is required');
      assert(err.details.errors[1].path === 'all[1].b');
      assert(err.details.errors[1].message === 'all[1].b is required');
      assert(err.details.errors[2].path === 'all[1].c');
      assert(err.details.errors[2].message === 'all[1].c is required');
    });
  }

  @Test()
  async verifyAccessors() {
    await assert.rejects(() => SchemaValidator.validate(Accessors, asFull({})),
      err => {
        assert(err instanceof ValidationResultError);
        assert(err.details.errors.length === 2);
        assert(err.details.errors[0].path === 'color');
        assert(err.details.errors[0].message === 'color is required');
        assert(err.details.errors[1].path === 'area');
        assert(err.details.errors[1].message === 'area is required');
      });

    await assert.doesNotReject(() =>
      SchemaValidator.validate(Accessors, asFull({ color: 'green', area: '5' }))
    );
  }

  @Test()
  async verifyTemplateLiteral() {
    await assert.rejects(() => SchemaValidator.validate(TemplateLit, asFull({})),
      err => {
        assert(err instanceof ValidationResultError);
        assert(err.details.errors.length === 1);
        assert(err.details.errors[0].path === 'age');
        assert(err.details.errors[0].message === 'age is required');
      }
    );

    for (const age of ['bob', '19-s', '19-es', 'z-y', '19-y']) {
      await assert.rejects(() => SchemaValidator.validate(TemplateLit, castTo({ age })),
        err => {
          assert(err instanceof ValidationResultError);
          assert(err.details.errors.length === 1);
          assert(err.details.errors[0].path === 'age');
          assert(err.details.errors[0].message.startsWith('age must match'));
        }
      );
    }

    await assert.doesNotReject(() =>
      SchemaValidator.validate(TemplateLit, asFull({ age: '19-ys' }))
    );
  }

  @Test()
  async verifyTemplateLiteralArray() {
    await assert.doesNotReject(() =>
      SchemaValidator.validate(TemplateLit, castTo({ age: '19-ys', height: ['10ft', '9m'] }))
    );

    for (const heights of [['bob'], ['19-s'], ['19-es'], ['z-y'], ['19-y'], ['8mm', '10ft']] as const) {
      await assert.rejects(() => SchemaValidator.validate(TemplateLit, castTo({ age: '19-ys', heights })),
        err => {
          assert(err instanceof ValidationResultError);
          assert(err.details.errors.length === 1);
          assert(err.details.errors[0].path === 'heights[0]');
          assert(err.details.errors[0].message.startsWith('heights[0] must match'));
        }
      );
    }
  }

  @Test()
  async verifyMinMaxValues() {
    // Valid cases
    await assert.doesNotReject(() =>
      SchemaValidator.validate(RangeSchema, { value: 10 })
    );
    await assert.doesNotReject(() =>
      SchemaValidator.validate(RangeSchema, { value: 50 })
    );
    await assert.doesNotReject(() =>
      SchemaValidator.validate(RangeSchema, { value: 100 })
    );

    // Invalid cases
    await assert.rejects(() => SchemaValidator.validate(RangeSchema, { value: 9 }), err => {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors.length === 1);
      assert(err.details.errors[0].path === 'value');
      assert(err.details.errors[0].message.includes('is less than (10)'));
    });

    await assert.rejects(() => SchemaValidator.validate(RangeSchema, { value: 101 }), err => {
      assert(err instanceof ValidationResultError);
      assert(err.details.errors.length === 1);
      assert(err.details.errors[0].path === 'value');
      assert(err.details.errors[0].message.includes('is greater than (100)'));
    });
  }
}
