import type { Primitive, UnknownRecord } from '@travetto/runtime';

import type { HttpMethod, HttpProtocol } from './core.ts';
import { BaseWebMessage } from './message.ts';

export interface WebConnection {
  host?: string;
  port?: number;
  ip?: string;
  httpProtocol?: HttpProtocol;
}

export interface WebRequestContext {
  path: string;
  pathParams?: Record<string, Primitive>;
  httpQuery?: UnknownRecord;
  httpMethod?: HttpMethod;
  connection?: WebConnection;
}

/**
 * Web Request object
 */
export class WebRequest<B = unknown> extends BaseWebMessage<B, Readonly<WebRequestContext>> {}
