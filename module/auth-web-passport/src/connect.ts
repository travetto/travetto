import { castTo } from '@travetto/runtime';
import { HttpRequest, HttpResponse } from '@travetto/web';

export class ConnectRequest {
  #req: HttpRequest;
  constructor(req: HttpRequest) {
    this.#req = req;
  }

  get url(): string {
    return this.#req.url;
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
  #res: HttpResponse;
  #sent = false;
  constructor(res?: HttpResponse) {
    this.#res = res ?? HttpResponse.fromEmpty();
  }

  get headersSent(): boolean {
    return this.#sent;
  }

  get statusCode(): number | undefined {
    return this.#res.statusCode;
  }
  writeHead(statusCode: unknown, statusMessage?: unknown, headers?: unknown): this {
    this.#res.statusCode = castTo(statusCode);
    this.#res.headers.setAll(castTo(headers));
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
    return this.#res.headers.getNames();
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