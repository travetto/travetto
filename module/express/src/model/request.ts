import { Request } from 'express';

export interface TypedRequest<T> extends Request {
  body: T;
}

export interface TypedBody<T> extends Request {
  body: T;
}

export interface TypedQuery<T> extends Request {
  query: T;
}
