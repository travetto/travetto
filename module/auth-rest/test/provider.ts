import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

import { IdentitySource } from '../';

class SimpleIdentitySource implements IdentitySource {
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
        source: 'dummy',
        permissions: [],
        details: {
          username: 'test'
        }
      } as Identity;
    } else {
      throw new AppError('Unable to authenticate, credentials are invalid', 'authentication');
    }
  }
}

@Suite()
export class IdentitySourceTest {
  @Test()
  async validateIdentitySource() {
    const ctx = await new SimpleIdentitySource().authenticate({ body: { username: 'test', password: 'test' } } as any, undefined as any);
    assert(ctx.id === 'test');
  }
}