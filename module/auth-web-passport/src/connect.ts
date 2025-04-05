import { castTo } from '@travetto/runtime';
import { WebRequest, WebResponse } from '@travetto/web';

export class ConnectRequest {
  #req: WebRequest;
  constructor(req: WebRequest) {
    this.#req = req;
  }

  get path(): string {
    return this.#req.path;
  }

  get headers(): Record<string, string> {
    return this.#req.headers.toObject();
  }

  get query(): Record<string, unknown> {
    return this.#req.query;
  }
}

export class ConnectResponse {
  #res: WebResponse;
  #sent = false;
  constructor(res?: WebResponse) {
    this.#res = res ?? WebResponse.fromEmpty();
  }

  get headersSent(): boolean {
    return this.#sent;
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
    this.#sent = true;
    return this;
  }
  setHeader(name: string, value: number | string | readonly string[]): this {
    this.#res.headers.set(name, typeof value === 'number' ? `${value}` : value);
    return this;
  }
  getHeader(name: string): number | string | string[] | undefined {
    return this.#res.headers.get(name);
  }
  getHeaders(): never {
    throw new Error('Method not implemented.');
  }
  getHeaderNames(): string[] {
    throw new Error('Method not implemented.');
  }
  hasHeader(name: string): boolean {
    return this.#res.headers.has(name);
  }
  removeHeader(name: string): void {
    this.#res.headers.delete(name);
  }
  flushHeaders(): void {
    throw new Error('Method not implemented.');
  }
  write(chunk: unknown, encoding?: unknown, callback?: unknown): boolean {
    throw new Error('Method not implemented.');
  }
  redirect(location: string, code?: number): this {
    this.#res.with({
      statusCode: code ?? 301,
      headers: { location }
    });
    return this;
  }

  end(chunk?: unknown, encoding?: unknown, cb?: unknown): this {
    if (chunk) {
      throw new Error('Method not implemented.');
    }
    this.#sent = true;
    return this;
  }

  throwIfSent(): void {
    if (!this.#sent) {
      throw this.#res;
    }
  }
}