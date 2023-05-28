import fetch, { BodyInit, Response } from 'node-fetch';

import { FetchRequestOptions, IFetchService, UploadContent } from './types';
import { CommonUtil, RequestOptions } from './common';

type MultiPart = UploadContent & { name: string };

/**
 * Fetch utilities
 */
export class FetchRequestUtil {

  static getMultipartRequest(chunks: MultiPart[]): { body: Buffer, headers: Record<string, string> } {
    const boundary = `-------------------------multipart-${Date.now()}-${Math.random()}-${process.pid}`.replace(/[.]/, '-');
    const nl = '\r\n';

    const header = (flag: boolean, key: string, ...values: (string | number | undefined)[]): string | Buffer =>
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

  static buildRequestShape(svc: IFetchService, params: unknown[], cfg: RequestOptions): FetchRequestOptions {
    return CommonUtil.buildRequest<IFetchService, BodyInit, UploadContent, MultiPart>(svc, params, cfg, {
      addItem: (name, item) => ({ ...item, name, }),
      addJson: (name, obj) => ({
        buffer: Buffer.from(JSON.stringify(obj)),
        type: 'application/json',
        name
      }),
      finalize: (items, req) => {
        if (items.length === 1) {
          req.headers['Content-Type'] = items[0].type!;
          return items[0].buffer;
        } else {
          const { body, headers } = this.getMultipartRequest(items);
          Object.assign(req.headers, headers);
          return body;
        }
      }
    });
  }

  static async getError(err: Error | Response): Promise<Error | unknown> {
    if (err instanceof Error) {
      try {
        // @ts-ignore
        const { AppError } = await import('@travetto/base');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        const ae = (err as any);
        if ('message' in ae && 'category' in ae) {
          return new AppError(ae.message, ae.category, ae.payload);
        }
      } catch { }
      return err;
    } else if (CommonUtil.isPlainObject(err)) {
      const out = new Error();
      Object.assign(out, err);
      return this.getError(out);
    } else if (err) {
      const out = new Error(err.statusText);
      Object.assign(out, { status: err.status });
      return this.getError(out);
    } else {
      return new Error('Unknown error');
    }
  }

  static async invoke<T>(svc: IFetchService, req: FetchRequestOptions): Promise<T> {
    try {
      for (const el of svc.preRequestHandlers) {
        req = await el(req) ?? req;
      }

      if (svc.debug) {
        console.debug('Making request', req);
      }

      let resolved = await fetch(req.url, req);

      for (const el of svc.postResponseHandlers) {
        resolved = await el(resolved) ?? resolved;
      }

      if (resolved.ok) {
        if (resolved.headers.get('content-type') === 'application/json') {
          const text = await resolved.text();
          return CommonUtil.consumeJSON<T>(text);
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return undefined as unknown as Promise<T>;
        }
      } else {
        let res;
        if (resolved.headers.get('content-type') === 'application/json') {
          const text = await resolved.text();
          res = CommonUtil.consumeJSON<Error>(text);
        } else {
          res = resolved;
        }
        if (svc.debug) {
          console.debug('Error in making request', res);
        }
        throw await this.getError(res);
      }
    } catch (err) {
      if (svc.debug) {
        console.debug('Error in initiating request', err);
      }
      if (err instanceof Error) {
        throw await this.getError(err);
      } else {
        throw err;
      }
    }
  }

  static async makeRequest<T>(svc: IFetchService, params: unknown[], cfg: RequestOptions): Promise<T> {
    return this.invoke(svc, this.buildRequestShape(svc, params, cfg));
  }
}