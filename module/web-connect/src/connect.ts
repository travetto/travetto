import type { OutgoingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

import { BinaryUtil, castTo, CodecUtil, type BinaryArray } from '@travetto/runtime';
import { type WebRequest, WebResponse } from '@travetto/web';

export class ConnectRequest implements Pick<IncomingMessage, 'url' | 'headers'> {

  /**
   * Get a connect incoming message given a framework request
   */
  static get(request: WebRequest): ConnectRequest & IncomingMessage {
    return castTo(new ConnectRequest(request));
  }

  #request: WebRequest;
  constructor(request: WebRequest) {
    this.#request = request;
  }

  get path(): string {
    return this.#request.context.path;
  }

  get url(): string {
    return this.#request.context.path;
  }

  get headers(): Record<string, string> {
    return Object.fromEntries(this.#request.headers.entries());
  }

  get query(): Record<string, unknown> {
    return this.#request.context.httpQuery ?? {};
  }
}

export class ConnectResponse implements Pick<ServerResponse,
  'getHeader' | 'getHeaderNames' | 'getHeaders' | 'hasHeader' |
  'headersSent' | 'write' | 'flushHeaders'
> {

  /**
   * Get a connect server response given a framework response
   */
  static get(response?: WebResponse): ConnectResponse & ServerResponse {
    return castTo(new ConnectResponse(response));
  }

  #response: WebResponse;
  #headersSent = false;
  #finished = false;
  #written: BinaryArray[] = [];
  #onEndHandlers: (() => void)[] = [];

  constructor(response?: WebResponse) {
    this.#response = response ?? new WebResponse();
  }

  get headersSent(): boolean {
    return this.#headersSent;
  }

  get finished(): boolean {
    return this.#finished;
  }

  get statusCode(): number | undefined {
    return this.#response.context.httpStatusCode;
  }

  set statusCode(code: number) {
    this.#response.context.httpStatusCode = code;
  }

  writeHead(statusCode: unknown, statusMessage?: unknown, headers?: unknown): this {
    this.#response.context.httpStatusCode = castTo(statusCode);
    for (const [key, value] of Object.entries(headers ?? {})) {
      this.#response.headers.set(key, typeof value === 'string' ? value : `${value}`);
    }
    this.#headersSent = true;
    return this;
  }
  setHeader(name: string, value: number | string | readonly string[]): this {
    if (Array.isArray(value)) {
      this.#response.headers.delete(name);
      for (const item of value) {
        this.#response.headers.append(name, item);
      }
    } else {
      this.#response.headers.set(name, `${value}`);
    }
    return this;
  }
  appendHeader(name: string, value: string | readonly string[]): this {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.#response.headers.append(name, item);
      }
    } else {
      this.#response.headers.append(name, `${value}`);
    }
    return this;
  }
  getHeader(name: string): number | string | string[] | undefined {
    return this.#response.headers.get(name)!;
  }
  getHeaders(): OutgoingHttpHeaders {
    return Object.fromEntries(this.#response.headers.entries());
  }
  getHeaderNames(): string[] {
    return [...this.#response.headers.keys()];
  }
  hasHeader(name: string): boolean {
    return this.#response.headers.has(name);
  }
  removeHeader(name: string): void {
    this.#response.headers.delete(name);
  }
  flushHeaders(): void {
    this.#headersSent = true;
  }
  write(chunk: unknown, encoding?: unknown, callback?: (error?: Error) => void): boolean {
    if (this.#headersSent) {
      this.flushHeaders();
    }
    const chunked = CodecUtil.readChunk(chunk, encoding ? `${encoding}` : undefined);
    this.#written.push(chunked);
    callback?.();
    return true;
  }
  redirect(location: string, code?: number): this {
    this.#response.context.httpStatusCode = code ?? 301;
    this.#response.headers.set('Location', location);
    return this;
  }

  end(chunk?: unknown, encoding?: unknown, callback?: () => void): this {
    this.flushHeaders();
    if (chunk) {
      this.write(chunk, encoding);
    }
    this.#finished = true;
    callback?.();
    for (const item of this.#onEndHandlers) {
      item();
    }
    return this;
  }

  on(type: 'end', handler: () => void): this {
    this.#onEndHandlers.push(handler);
    return this;
  }

  throwIfSent(): void {
    if (this.#headersSent) {
      this.#response.body = BinaryUtil.combineBinaryArrays(this.#written);
      throw this.#response;
    }
  }
}