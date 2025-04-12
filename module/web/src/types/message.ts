import { HttpProtocol } from './core';
import { WebHeaders, WebHeadersInit } from './headers';

export interface WebMessageInit<B = unknown> {
  body?: B;
  headers?: WebHeadersInit;
}

export interface WebMessage<B = unknown> {
  body?: B;
  headers: WebHeaders;
}