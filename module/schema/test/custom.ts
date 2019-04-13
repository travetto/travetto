import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';

import { Schema, SchemaRegistry } from '..';
import { Validator } from '../src/decorator/schema';
import { SchemaValidator } from '../src/validate/validator';
import { ValidationResultError } from '../src/validate/error';

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
@Validator(async (user: User) => {
  const p = user.password;
  const hasNum = /\d/.test(p);
  const hasSpecial = /[!@#$%%^&*()<>?/,.;':"']/.test(p);
  const noRepeat = !/(.)(\1)/.test(p);
  await new Promise(r => setTimeout(r, 10));
  if (!hasNum || !hasSpecial || !noRepeat) {
    return {
      kind: 'password-rules',
      path: 'password',
      message: 'A password must include at least one number, one special char, and have no repeating characters'
    };
  }
})
class AsyncUser {
  password: string;
}

@Suite()
export class CustomTest {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
  }

  @Test()
  async validateCustom() {
    const u = User.from({
      password: 'orange'
    });
    await assert.rejects(() => SchemaValidator.validate(u), 'Validation errors');
    await assert.rejects(() => SchemaValidator.validate(u), (err: ValidationResultError) => {
      if (!err.errors.find(x => x.message.includes('A password must'))) {
        return err;
      }
    });
  }

  @Test()
  async validateCustomAsync() {
    const u = AsyncUser.from({
      password: 'orange'
    });
    await assert.rejects(() => SchemaValidator.validate(u), 'Validation errors');
    await assert.rejects(() => SchemaValidator.validate(u), (err: ValidationResultError) => {
      if (!err.errors.find(x => x.message.includes('A password must'))) {
        return err;
      }
    });
  }
}