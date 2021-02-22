import { RootRegistry } from '@travetto/registry';
import { AppError } from '@travetto/base';
import { StreamUtil } from '@travetto/boot';

import { MethodOrAll, Request, ServerHandle } from '../src/types';
import { MakeRequestConfig, MakeRequestResponse, RestServerSupport } from './base/base';
import { AfterAll, BeforeAll, Suite } from '@travetto/test';
import { AwsLambdaRestServerSupport } from './base/aws-lambda';
import { CoreRestServerSupport } from './base/core';

/**
 * Base Rest Suite
 */
@Suite()
export abstract class BaseRestSuite {

  private handle: ServerHandle | undefined;
  private support: RestServerSupport;

  constructor(support: number | true | RestServerSupport) {
    if (typeof support === 'number') {
      this.support = new CoreRestServerSupport(support);
    } else if (typeof support === 'boolean') {
      this.support = new AwsLambdaRestServerSupport();
    } else {
      this.support = support;
    }
  }

  async wait(n: number) {
    return new Promise(r => setTimeout(r, n));
  }

  async getOutput<T>(t: Buffer) {
    const content = t.toString('utf8');
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      return content;
    }
  }

  @BeforeAll()
  async initServer() {
    await RootRegistry.init();
    this.handle = await this.support.init();
  }

  @AfterAll()
  async destroySever() {
    if (this.handle) {
      await this.handle.close?.();
      delete this.handle;
    }
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