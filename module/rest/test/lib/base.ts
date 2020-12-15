import * as qs from 'querystring';
import * as fetch from 'node-fetch';
import FormData from 'formdata-node';

import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { AppError, Util } from '@travetto/base';
import { StreamUtil } from '@travetto/boot';

import type { RestServer } from '../../src/server/server';
import { ServerHandle } from '../../src/types';
import { RestLambdaSymbol } from '../../src/internal/lambda';


const toMultiValue = (o: Record<string, string> | undefined) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, [v]]));
const baseLambdaEvent = { resource: '/{proxy+}' };
const baseLambdaContext = {
  accountId: Util.uuid(),
  resourceId: Util.uuid(),
  requestId: Util.uuid(),
  apiId: Util.uuid(),
  requestTimeEpoch: 1428582896000,
  resourcePath: '/{proxy+}',
  protocol: 'HTTP/1.1'
};

async function getOutput(t: string | Promise<string>) {
  try {
    t = await t;
  } catch {
    return undefined;
  }
  try {
    return JSON.parse(t);
  } catch (e) {
    return t;
  }
}

export abstract class BaseRestSuite {

  private handle: ServerHandle | undefined;
  private server: RestServer<any>;
  private port: number = -1;
  private awsLambda: boolean = false;

  constructor(lambdaOrPort: number | true) {
    if (typeof lambdaOrPort === 'boolean') {
      this.awsLambda = lambdaOrPort;
    } else {
      this.port = lambdaOrPort;
    }
  }


  get url() {
    return `http://localhost:${this.port}`;
  }

  async wait(n: number) {
    return new Promise(r => setTimeout(r, n));
  }

  async initServer() {
    await RootRegistry.init();

    const rest = await import('../..');

    Object.assign(
      await DependencyRegistry.getInstance(rest.RestCookieConfig),
      { active: true, secure: false, signed: false }
    );

    if (!this.awsLambda) {
      this.server = await DependencyRegistry.getInstance(rest.RestServer);

      this.server.config.port = this.port;
      this.server.config.ssl.active = false;

      this.handle = await this.server.run();

      const start = Date.now();

      while ((Date.now() - start) < 5000) {
        try {
          await fetch(this.url);
          return; // We good
        } catch {
          await new Promise(res => setTimeout(res, 100));
        }
      }
    } else {
      this.server = await DependencyRegistry.getInstance(rest.RestServer, RestLambdaSymbol);
      this.handle = await this.server.run();
    }
  }

  async makeRequst(method: 'get' | 'post' | 'patch' | 'put' | 'delete' | 'options', path: string, { query, headers, body }: {
    query?: Record<string, any>;
    body?: Record<string, any> | FormData;
    headers?: Record<string, string>;
  } = {}) {
    const httpMethod = method.toUpperCase();
    let resp: { status: number, body: any, headers: [string, string | string[]][] };

    let buffer: Buffer | undefined;
    if (body) {
      if (body instanceof Buffer) {
        buffer = body;
      } else if (body instanceof FormData) {
        buffer = await StreamUtil.toBuffer(body.stream);
      } else {
        headers = headers || {};
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
        buffer = Buffer.from(JSON.stringify(body));
      }
    }

    if (!this.awsLambda) {
      let q = '';
      if (query && Object.keys(query).length) {
        q = `?${qs.stringify(query)}`;
      }
      const res = await fetch(`${this.url}${path}${q}`, {
        method: httpMethod,
        headers,
        body: buffer
      });
      resp = { status: res.status, body: await getOutput(res.text()), headers: [...res.headers] };
    } else {
      const res = await (this.server as any).handle({
        ...baseLambdaEvent,
        path,
        httpMethod,
        queryStringParameters: query,
        headers,
        isBase64Encoded: true,
        body: buffer ? buffer.toString('base64') : buffer,
        multiValueQueryStringParameters: toMultiValue(query),
        multiValueHeaders: toMultiValue(headers),
        requestContext: { ...baseLambdaContext, path, httpMethod }
      });
      const outText = res.isBase64Encoded ? Buffer.from(res.body, 'base64').toString('utf8') : res.body;
      const out = await getOutput(outText);
      if (res.statusCode >= 300) {
        throw out;
      }
      resp = {
        status: res.statusCode, body: out, headers: [
          ...Object.entries(res.headers as Record<string, string>),
          ...Object.entries((res.multiValueHeaders ?? {}) as Record<string, string[]>)
        ]
      };
    }
    if (resp.status >= 300) {
      const err = new AppError('Failure');
      Object.assign(err, resp.body);
      throw err;
    }
    return {
      body: resp.body,
      headers: Object.fromEntries(resp.headers.map(([k, v]) =>
        [k.toLowerCase(), Array.isArray(v) ? v[0] : v]))
    };
  }

  async destroySever() {
    if (this.handle) {
      await this.handle.close?.();
      delete this.handle;
    }
  }
}