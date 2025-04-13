import { Readable } from 'node:stream';
import { WebHeaders, WebHeadersInit } from './headers';

export type WebBinaryBody = Readable | Buffer;

export interface WebMessageInit<B = unknown> {
  body?: B;
  headers?: WebHeadersInit;
}

export interface WebMessage<B = unknown> {
  body?: B;
  headers: WebHeaders;
}