import { AuthContext } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';

export abstract class AuthProvider<U> {

  async logout(req: Request, res: Response): Promise<void> {
    // Do nothing
  }

  abstract async login(req: Request, res: Response): Promise<AuthContext<U> | undefined>;

  abstract toContext(principal: U): AuthContext<U>;

  serialize(ctx: AuthContext<U>) {
    return JSON.stringify({
      id: ctx.id,
      permissions: Array.from(ctx.permissions || new Set()),
      principal: ctx.principal
    });
  }

  async deserialize(serialized: string): Promise<AuthContext<U>> {
    const ctx = JSON.parse(serialized);
    return {
      id: ctx.id,
      permissions: new Set(ctx.permissions || []),
      principal: ctx.principal
    };
  }
}