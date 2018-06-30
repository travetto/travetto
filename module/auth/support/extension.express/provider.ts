import { Request, Response } from 'express';
import { AppError } from '@travetto/express';
import { PrincipalConfig } from '../../src';

export class AuthProvider<U, T extends PrincipalConfig<U> = PrincipalConfig<U>> {
  constructor(protected principal: T) { }

  async login(req: Request, res: Response): Promise<U> {
    throw new AppError('Unimplemented login');
  }

  async logout(req: Request, res: Response): Promise<void> {
    // Do nothing
  }

  serialize(user: U): string {
    return this.principal.getId(user);
  }

  async deserialize(id: string): Promise<U> {
    throw new AppError('Unimplemented deserialize');
  }
}