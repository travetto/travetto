import { castTo } from '@travetto/runtime';
import { WebRequest, WebResponse } from '@travetto/web';
import { OutgoingHttpHeaders } from 'http';
import { IncomingMessage, ServerResponse } from 'node:http';

export class ConnectRequest implements Pick<IncomingMessage, 'url' | 'headers'> {
  #req: WebRequest;
  constructor(req: WebRequest) {
    this.#req = req;
  }

  get path(): string {
    return this.#req.path;
  }

  get url(): string {
    return this.#req.path;
  }

  get headers(): Record<string, string> {
    return Object.fromEntries(this.#req.headers.entries());
  }

  get query(): Record<string, unknown> {
    return this.#req.query;
  }
}

export class ConnectResponse implements Pick<ServerResponse,
  'getHeader' | 'getHeaderNames' | 'getHeaders' | 'hasHeader' |
  'headersSent' | 'write' | 'flushHeaders'
> {
  #res: WebResponse;
  #headersSent = false;
  #finished = false;
  #written: Buffer[] = [];

  constructor(res?: WebResponse) {
    this.#res = res ?? WebResponse.fromEmpty();
  }

  get headersSent(): boolean {
    return this.#headersSent;
  }

  get finished(): boolean {
    return this.#finished;
  }

  get statusCode(): number | undefined {
    return this.#res.statusCode;
  }

  set statusCode(val: number) {
    this.#res.statusCode = val;
  }

  writeHead(statusCode: unknown, statusMessage?: unknown, headers?: unknown): this {
    this.#res.statusCode = castTo(statusCode);
    for (const [k, v] of Object.entries(headers ?? {})) {
      this.#res.headers.set(k, v);
    }
    this.#headersSent = true;
    return this;
  }
  setHeader(name: string, value: number | string | readonly string[]): this {
    if (Array.isArray(value)) {
      this.#res.headers.delete(name);
      for (const item of value) {
        this.#res.headers.append(name, item);
      }
    } else {
      this.#res.headers.set(name, `${value}`);
    }
    return this;
  }
  appendHeader(name: string, value: string | readonly string[]): this {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.#res.headers.append(name, item);
      }
    } else {
      this.#res.headers.append(name, `${value}`);
    }
    return this;
  }
  getHeader(name: string): number | string | string[] | undefined {
    return this.#res.headers.get(name)!;
  }
  getHeaders(): OutgoingHttpHeaders {
    return Object.fromEntries(this.#res.headers.entries());
  }
  getHeaderNames(): string[] {
    return [...this.#res.headers.keys()];
  }
  hasHeader(name: string): boolean {
    return this.#res.headers.has(name);
  }
  removeHeader(name: string): void {
    this.#res.headers.delete(name);
  }
  flushHeaders(): void {
    this.#headersSent = true;
  }
  write(chunk: unknown, encoding?: unknown, callback?: unknown): boolean {
    if (this.#headersSent) {
      this.flushHeaders();
    }
    if (!Buffer.isBuffer(chunk)) {
      this.#written.push(Buffer.from(`${chunk}`, castTo(encoding)));
    } else {
      this.#written.push(chunk);
    }
    return true;
  }
  redirect(location: string, code?: number): this {
    this.#res.with({
      statusCode: code ?? 301,
      headers: { location }
    });
    return this;
  }

  end(chunk?: unknown, encoding?: unknown, cb?: unknown): this {
    this.flushHeaders();
    if (chunk) {
      this.write(chunk, encoding);
    }
    this.#finished = true;
    return this;
  }

  throwIfSent(): void {
    if (!this.#headersSent) {
      this.#res.payload = Buffer.concat(this.#written);
      throw this.#res;
    }
  }
}