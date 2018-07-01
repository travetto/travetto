import { Request, Response } from 'express';
import { AuthContext } from '../../src';

export abstract class AuthProvider<U> {

  async logout(req: Request, res: Response): Promise<void> {
    // Do nothing
  }

  abstract async login(req: Request, res: Response): Promise<AuthContext<U>>;

  serialize(ctx: AuthContext<U>) {
    return JSON.stringify({
      id: ctx.id,
      permissions: Array.from(ctx.permissions),
      principal: ctx.principal
    });
  }

  async deserialize(serialized: string): Promise<AuthContext<U>> {
    const ctx = JSON.parse(serialized);
    return {
      id: ctx.id,
      permissions: new Set(ctx.permissions),
      principal: ctx.principal
    };
  }
}