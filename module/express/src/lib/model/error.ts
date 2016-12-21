import { Response } from 'express';
import { ExtendableError } from '@encore/util';
import { Renderable } from './renderable';

export class AppError extends ExtendableError implements Renderable {
  constructor(message: string, public status: number = 500) {
    super(message);
  }

  render(res: Response) {
    res.status(this.status);
    res.json({ message: this.message, status: this.status });
  }
}