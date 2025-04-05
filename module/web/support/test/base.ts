import { buffer as toBuffer } from 'node:stream/consumers';
import assert, { AssertionError } from 'node:assert';

import { RootRegistry } from '@travetto/registry';
import { AppError, castTo, Class, classConstruct, Util } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';

import { WebServerHandle } from '../../src/types/server.ts';
import { WebRequest, WebRequestInit } from '../../src/types/request.ts';
import { WebResponse } from '../../src/types/response.ts';

import { WebServerSupport } from './server-support/base.ts';

type Multipart = { name: string, type?: string, buffer: Buffer, filename?: string, size?: number };

/**
 * Base Web Suite
 */
export abstract class BaseWebSuite {

  #handle?: WebServerHandle;
  #support: WebServerSupport;

  type: Class<WebServerSupport>;
  qualifier?: symbol;

  @BeforeAll()
  async initServer(): Promise<void> {
    this.#support = classConstruct(this.type);
    await RootRegistry.init();
    this.#handle = await this.#support.init(this.qualifier);
  }

  get port(): number | undefined {
    return 'port' in this.#support && typeof this.#support['port'] === 'number' ? this.#support.port : undefined;
  }

  async getOutput<T>(t: Buffer): Promise<T | string> {
    try {
      return JSON.parse(t.toString('utf8'));
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

  getMultipartRequest(chunks: Multipart[]): WebRequest {
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

    const body = Buffer.concat(lines.map(l => Buffer.isBuffer(l) ? l : Buffer.from(l)));

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': `${body.length}`
    };

    return new WebRequest({ body, headers });
  }

  async request<T>(cfg: WebRequest | WebRequestInit, throwOnError: boolean = true): Promise<WebResponse<T>> {

    const req = !(cfg instanceof WebRequest) ? new WebRequest(cfg) : cfg;

    const body = req.body;
    if (body) {
      if (body instanceof Buffer) {
        // Do nothing
      } else if (typeof body === 'string') {
        req.body = Buffer.from(body);
      } else if ('stream' in body) {
        req.body = await toBuffer(castTo(body.stream));
      } else {
        req.body = Buffer.from(JSON.stringify(body));
        req.headers.set('Content-Type', req.headers.get('Content-Type') ?? 'application/json');
      }
    }

    Object.assign(req, { query: BindUtil.flattenPaths(req.query ?? {}) });

    const res = await this.#support.execute(req);
    const buffer = Buffer.isBuffer(res.output) ? res.output : await toBuffer(res.output);
    const out = await this.getOutput<T>(buffer);

    if (res.statusCode && res.statusCode >= 400) {
      if (throwOnError) {
        const err = new AppError(res.output.toString('utf8'));
        Object.assign(err, { status: res.statusCode });
        throw err;
      }
    }
    res.source = castTo(out);
    return castTo(res);
  }
}