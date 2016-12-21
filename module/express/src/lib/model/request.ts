import { Request } from 'express';

export interface TypedRequest<T> extends Request {
  body: T;
}

export interface TypedBody<T> extends Request {
  body: T;
}

export interface TypeQuery<T> extends Request {
  query: T;
}
