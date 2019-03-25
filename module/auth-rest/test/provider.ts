import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

import { IdentityProvider, ERR_INVALID_CREDS } from '../';

class DumbProvider extends IdentityProvider {
  toContext(user: { id: string, username: string }) {
    return {
      id: user.id,
      principal: user
    };
  }
  async authenticate(req: Request, res: Response) {
    const { username, password } = req.body;
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        provider: 'dummy',
        permissions: [],
        details: {
          username: 'test'
        }
      } as Identity;
    } else {
      throw new AppError(ERR_INVALID_CREDS, 'authentication');
    }
  }
}

@Suite()
export class ProviderTest {
  @Test()
  async validateProvider() {
    const ctx = await new DumbProvider().authenticate({ body: { username: 'test', password: 'test' } } as any, undefined as any);
    assert(ctx.id === 'test');
  }
}