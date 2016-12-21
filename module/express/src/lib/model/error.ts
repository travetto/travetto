import { Response } from 'express';
import { BaseError } from '@encore/util';
import { Renderable } from './renderable';

type Status = { status: number };

export class AppError extends BaseError<Status> implements Renderable {
  constructor(message: string, status: number = 500) {
    super(message, { status });
  }

  render(res: Response) {
    res.status(this.payload.status);
    res.json({ message: this.message, status: this.payload.status });
  }
}