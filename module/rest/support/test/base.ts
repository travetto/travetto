import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';

import { RootRegistry } from '@travetto/registry';
import { AppError, ConcreteClass, Util } from '@travetto/base';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';

import { MethodOrAll, Request, ServerHandle } from '../../src/types';
import { MakeRequestConfig, MakeRequestResponse, RestServerSupport } from './server-support/base';
import { CoreRestServerSupport } from './server-support/core';

type Multipart = { name: string, type?: string, buffer: Buffer, filename?: string, size?: number };

type FullRequest = MakeRequestConfig<Buffer | string | { stream: Readable } | Record<string, unknown>> & { throwOnError?: boolean };

/**
 * Base Rest Suite
 */
export abstract class BaseRestSuite {

  #handle?: ServerHandle;
  #support: RestServerSupport;

  type: ConcreteClass<RestServerSupport>;
  qualifier?: symbol;

  @BeforeAll()
  async initServer(): Promise<void> {
    if (!this.type || this.type === CoreRestServerSupport) {
      this.#support = new CoreRestServerSupport((Util.naiveHash(this.constructor.Ⲑid) % 60000) + 2000);
    } else {
      this.#support = new this.type();
    }
    await RootRegistry.init();
    this.#handle = await this.#support.init(this.qualifier);
  }

  get port(): number | undefined {
    return this.#support instanceof CoreRestServerSupport ? this.#support.port : undefined;
  }

  getFirstHeader(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
    const v = headers[key];
    if (v) {
      if (typeof v === 'string') {
        return v;
      } else {
        return v[0];
      }
    }
  }

  async getOutput<T>(t: Buffer): Promise<T | string> {
    try {
      return JSON.parse(t.toString('utf8')) as T;
    } catch {
      return t.toString('utf8');
    }
  }

  @AfterAll()
  async destroySever(): Promise<void> {
    if (this.#handle) {
      await this.#handle.close?.();
      this.#handle = undefined;
    }
  }

  getMultipartRequest(chunks: Multipart[]): FullRequest {
    const boundary = `-------------------------multipart-${Util.uuid()}`;

    const nl = '\r\n';

    const header = (flag: boolean, key: string, ...values: (string | number | undefined)[]) =>
      flag ? `${key}: ${values.map(v => `${v}`).join(';')}${nl}` : Buffer.alloc(0);

    const lines = [
      ...chunks.flatMap(chunk => [
        '--', boundary, nl,
        header(true, 'Content-Disposition', 'form-data', `name="${chunk.name}"`, `filename="${chunk.filename ?? chunk.name}"`),
        header(!!chunk.size, 'Content-Length', chunk.size),
        header(!!chunk.type, 'Content-Type', chunk.type),
        nl,
        chunk.buffer, nl
      ]),
      '--', boundary, '--', nl
    ];

    const body = Buffer.concat(lines.map(l => Buffer.from(l)));

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': `${body.length}`
    };

    return { body, headers };
  }

  async request<T>(
    method: Request['method'] | Exclude<MethodOrAll, 'all'>,
    path: string,
    cfg: FullRequest = {}
  ): Promise<MakeRequestResponse<T>> {

    method = method.toUpperCase() as Request['method'];

    cfg.headers ??= {};

    let buffer: Buffer | undefined;
    const body = cfg.body;
    if (body) {
      if (body instanceof Buffer) {
        buffer = body;
      } else if (typeof body === 'string') {
        buffer = Buffer.from(body);
      } else if ('stream' in body) {
        buffer = await toBuffer(body.stream as Readable);
      } else {
        buffer = Buffer.from(JSON.stringify(body));
        cfg.headers['Content-Type'] = cfg.headers['Content-Type'] ?? 'application/json';
      }
    }

    cfg.body = body;
    cfg.query = BindUtil.flattenPaths(cfg.query ?? {});

    const resp = await this.#support.execute(method, path, { ...cfg, body: buffer });
    const out = await this.getOutput<T>(resp.body);

    if (resp.status >= 400) {
      if (cfg.throwOnError ?? true) {
        const err = new AppError('Error');
        if (Buffer.isBuffer(resp.body)) {
          err.message = resp.body.toString('utf8');
        } else {
          Object.assign(err, resp.body);
        }
        Object.assign(err, { status: resp.status });
        throw err;
      }
    }
    return {
      status: resp.status,
      body: out as T,
      headers: Object.fromEntries(Object.entries(resp.headers).map(([k, v]) => [k.toLowerCase(), v]))
    };
  }
}