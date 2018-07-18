import { Suite, Test } from '@travetto/test';
import { AuthProvider } from '../src';
import * as assert from 'assert';
import { Request, Response } from 'express';
import { ERR_INVALID_CREDS } from '@travetto/auth';

class DumbProvider extends AuthProvider<any> {
  toContext(user: { id: string, username: string }) {
    return {
      id: user.id,
      principal: user
    };
  }
  async login(req: Request, res: Response) {
    const { username, password } = req.body;
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        permissions: new Set(),
        principal: {
          username: 'test'
        }
      };
    } else {
      throw new Error(ERR_INVALID_CREDS);
    }
  }
}

@Suite()
export class ProviderTest {
  @Test()
  async validateProvider() {
    const ctx = await new DumbProvider().login({ body: { username: 'test', password: 'test' } } as any, undefined as any);
    assert(ctx.id === 'test');
  }
}