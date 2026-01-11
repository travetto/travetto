import type { Readable } from 'node:stream';
import { castTo } from '@travetto/runtime';
import { WebHeaders, type WebHeadersInit } from './headers.ts';

export type WebBinaryBody = Readable | Buffer;

export interface WebMessageInit<B = unknown, C = unknown> {
  context?: C;
  headers?: WebHeadersInit;
  body?: B;
}

export interface WebMessage<B = unknown, C = unknown> {
  readonly context: C;
  readonly headers: WebHeaders;
  body?: B;
}

/**
 * Common implementation for a rudimentary web message (request / response)
 */
export class BaseWebMessage<B = unknown, C = unknown> implements WebMessage<B, C> {
  readonly context: C;
  readonly headers: WebHeaders;
  body?: B;

  constructor(input: WebMessageInit<B, C> = {}) {
    this.context = input.context ?? castTo<C>({});
    this.headers = new WebHeaders(input.headers);
    this.body = input.body;
  }
}