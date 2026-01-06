import { AuthenticationError, type Authenticator } from '@travetto/auth';

type User = { username: string, password: string };

export class SimpleAuthenticator implements Authenticator<User> {
  async authenticate({ username, password }: User) {
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        source: 'simple',
        permissions: [],
        details: {
          username: 'test'
        }
      };
    } else {
      throw new AuthenticationError('Invalid credentials');
    }
  }
}