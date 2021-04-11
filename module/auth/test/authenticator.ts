import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { Authenticator } from '@travetto/auth';

type User = { username: string, password: string };

class SimpleAuthenticator implements Authenticator<User> {
  toContext(user: { id: string, username: string }) {
    return {
      id: user.id,
      principal: user
    };
  }
  async authenticate({ username, password }: User) {
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        issuer: 'dummy',
        permissions: [],
        details: {
          username: 'test'
        }
      };
    } else {
      throw new AppError('Unable to authenticate, credentials are invalid', 'authentication');
    }
  }
}

@Suite()
export class AuthenticatorTest {
  @Test()
  async validateAuthenticator() {
    const ctx = await new SimpleAuthenticator().authenticate(
      { username: 'test', password: 'test' }
    );
    assert(ctx.id === 'test');
  }
}