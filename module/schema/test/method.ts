import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { MaxLength } from '../src/decorator/field.ts';
import { ValidationResultError } from '../src/validate/error.ts';
import { ValidationError } from '../src/validate/types.ts';
import { SchemaValidator } from '../src/validate/validator.ts';
import { MethodValidator } from '../src/decorator/schema.ts';


const nameValidator = (name: string): ValidationError | undefined => {
  if (name === 'bob') {
    return {
      kind: 'invalid',
      path: 'name',
      message: 'Name cannot be bob'
    };
  }
};

const EvenValidator = MethodValidator((name: string): ValidationError | undefined => {
  if (name.length % 2 !== 0) {
    return {
      kind: 'format',
      path: 'name',
      message: 'Name must be even length'
    };
  }
});

class TestClass {

  @MethodValidator(nameValidator)
  @EvenValidator
  value(@MaxLength(10) name: string) {
    return name;
  }
}

@Suite('SchemaValidator - Method Level Validations')
class SchemaValidatorMethodSuite {

  @Test('should validate method with correct schema')
  async testValidMethod() {
    await RootRegistry.init();

    await assert.doesNotReject(() =>
      SchemaValidator.validateMethod(TestClass, 'value', ['greg'])
    );

    await assert.rejects(
      async () =>
        SchemaValidator.validateMethod(TestClass, 'value', ['bob']),
      e => e instanceof ValidationResultError && e.details.errors.some(x => /name cannot be bob/i.test(x.message))
    );

    await assert.rejects(
      async () => SchemaValidator.validateMethod(TestClass, 'value', ['bob bob bob bob']),
      e => e instanceof ValidationResultError && e.details.errors.some(x => /too long/i.test(x.message))
    );

    await assert.rejects(
      async () => SchemaValidator.validateMethod(TestClass, 'value', ['bob bob bob bob']),
      e => e instanceof ValidationResultError && e.details.errors.some(x => /even/i.test(x.message))
    );

    await assert.rejects(
      async () => SchemaValidator.validateMethod(TestClass, 'value', ['bob bob bob bob']),
      e =>
        e instanceof ValidationResultError &&
        e.details.errors.find(x => /too long/i.test(x.message)) &&
        e.details.errors.find(x => /even/i.test(x.message))
    );
  }
}