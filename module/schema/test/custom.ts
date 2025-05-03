import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { Schema, SchemaValidator, ValidationResultError, Validator } from '@travetto/schema';

@Schema()
@Validator((user: User) => {
  const p = user.password;
  const hasNum = /\d/.test(p);
  const hasSpecial = /[!@#$%%^&*()<>?/,.;':"']/.test(p);
  const noRepeat = !/(.)(\1)/.test(p);
  if (!hasNum || !hasSpecial || !noRepeat) {
    return {
      kind: 'password-rules',
      path: 'password',
      message: 'A password must include at least one number, one special char, and have no repeating characters'
    };
  }
})
class User {
  password: string;
}

@Schema()
@Validator(async (user: AsyncUser) => {
  const p = user.passwordSpecial;
  const hasNum = /\d/.test(p);
  const hasSpecial = /[!@#$%%^&*()<>?/,.;':"']/.test(p);
  const noRepeat = !/(.)(\1)/.test(p);
  await timers.setTimeout(10);
  if (!hasNum || !hasSpecial || !noRepeat) {
    return {
      kind: 'password-rules',
      path: 'password',
      message: 'A password must include at least one number, one special char, and have no repeating characters'
    };
  }
})
class AsyncUser {
  passwordSpecial: string;
}

@Suite()
export class CustomTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async validateCustom() {
    const u = User.from({
      password: 'orange'
    });
    await assert.rejects(() => SchemaValidator.validate(User, u), 'Validation errors');
    await assert.rejects(() => SchemaValidator.validate(User, u),
      e => e instanceof ValidationResultError && e.details.errors.some(x => x.message.includes('A password must'))
    );
  }

  @Test()
  async validateCustomAsync() {
    const u = AsyncUser.from({
      passwordSpecial: 'orange'
    });
    await assert.rejects(() => SchemaValidator.validate(AsyncUser, u), 'Validation errors');
    await assert.rejects(() => SchemaValidator.validate(AsyncUser, u),
      e => e instanceof ValidationResultError && e.details.errors.some(x => x.message.includes('A password must'))
    );
  }
}