import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { AuthenticationError, Authenticator } from '@travetto/auth';

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
      throw new AuthenticationError('Unable to authenticate, credentials are invalid');
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