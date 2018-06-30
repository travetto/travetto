import { Request, Response } from 'express';
import { AppError } from '@travetto/express';
import { AuthContext } from '../../src';

export class AuthProvider<U> {
  constructor() { }

  async login(req: Request, res: Response): Promise<U> {
    throw new AppError('Unimplemented login');
  }

  async toContext(user: U): Promise<AuthContext<U>> {
    throw new AppError('Unimplemented toContext');
  }

  async logout(req: Request, res: Response): Promise<void> {
    // Do nothing
  }

  serialize(user: U): string {
    throw new AppError('Unimplemented serialize');
  }

  async deserialize(id: string): Promise<U> {
    throw new AppError('Unimplemented deserialize');
  }
}