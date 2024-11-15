import assert from 'node:assert';
import { Suite, Test, ShouldThrow, BeforeEach } from '@travetto/test';
import { MaxLength, MethodValidator, SchemaValidator, ValidationResultError, Validator } from '../__index__';
import { RootRegistry } from '@travetto/registry';

class TestClass {
  @MethodValidator(([name]) => {
    if (name === 'bob') {
      return {
        kind: 'invalid',
        path: 'name',
        message: 'Name cannot be bob'
      };
    }
    if (name.length > 10) {
      return {
        kind: 'maxlength',
        path: 'name',
        n: 10,
        message: 'Name cannot be longer than 10 characters'
      };
    }
  })
  value(name: string) {
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
      e =>
        (e instanceof ValidationResultError && !e.details.errors.find(x => /name cannot be bob/i.test(x.message)) ? e : undefined)
    );

    await assert.rejects(
      async () => SchemaValidator.validateMethod(TestClass, 'value', ['bob bob bob bob']),
      e => (e instanceof ValidationResultError && !e.details.errors.find(x => /name cannot be longer/i.test(x.message)) ? e : undefined)
    );
  }
}