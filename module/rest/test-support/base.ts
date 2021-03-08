import { RootRegistry } from '@travetto/registry';
import { AppError, Util } from '@travetto/base';
import { StreamUtil } from '@travetto/boot';
import { AfterAll, BeforeAll } from '@travetto/test';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { MethodOrAll, Request, ServerHandle } from '../src/types';
import { MakeRequestConfig, MakeRequestResponse, RestServerSupport } from './server-support/base';
import { AwsLambdaRestServerSupport } from './server-support/aws-lambda';
import { CoreRestServerSupport } from './server-support/core';

type Multipart = { name: string, type?: string, buffer: Buffer, filename?: string, size?: number };

/**
 * Base Rest Suite
 */
export abstract class BaseRestSuite {

  private handle?: ServerHandle;
  private support: RestServerSupport;

  type: string | RestServerSupport = 'core';

  @BeforeAll()
  async initServer() {
    if (this.type === 'core') {
      this.support = new CoreRestServerSupport((SystemUtil.naiveHash(this.constructor.ᚕid) % 60000) + 1000);
    } else if (this.type === 'lambda') {
      this.support = new AwsLambdaRestServerSupport();
    } else if (typeof this.type !== 'string') {
      this.support = this.type;
    }
    await RootRegistry.init();
    this.handle = await this.support.init();
  }

  async wait(n: number) {
    return new Promise(r => setTimeout(r, n));
  }

  async getOutput<T>(t: Buffer) {
    try {
      return JSON.parse(t.toString('utf8')) as T;
    } catch (e) {
      return t.toString('utf8');
    }
  }

  @AfterAll()
  async destroySever() {
    if (this.handle) {
      await this.handle.close?.();
      delete this.handle;
    }
  }

  getMultipartRequest(chunks: Multipart[]) {
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

  async request(
    method: Request['method'] | Exclude<MethodOrAll, 'all'>,
    path: string,
    cfg: MakeRequestConfig<Buffer | string | { stream: NodeJS.ReadableStream } | Record<string, unknown>> & { throwOnError?: boolean } = {}
  ): Promise<MakeRequestResponse<any>> {

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
        buffer = await StreamUtil.toBuffer(body.stream as NodeJS.ReadableStream);
      } else {
        buffer = Buffer.from(JSON.stringify(body));
        cfg.headers['Content-Type'] = cfg.headers['Content-Type'] ?? 'application/json';
      }
    }

    cfg.body = body;

    const resp = await this.support.execute(method, path, { ...cfg, body: buffer });
    const out = await this.getOutput<any>(resp.body);

    if (resp.status >= 400) {
      if (cfg.throwOnError ?? true) {
        const err = new AppError(out.message ?? 'Error');
        Object.assign(err, resp.body);
        throw err;
      }
    }
    return {
      status: resp.status,
      body: out,
      headers: Object.fromEntries(Object.entries(resp.headers).map(([k, v]) =>
        [k.toLowerCase(), Array.isArray(v) ? v[0] : v]))
    };
  }
}