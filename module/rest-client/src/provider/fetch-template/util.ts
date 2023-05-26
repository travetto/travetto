import fetch, { BodyInit, Response } from 'node-fetch';

import { FetchRequestShape, IFetchService, ParamConfig, UploadContent } from './types';

type MultiPart = UploadContent & { name: string };

/**
 * Fetch utilities
 */
export class FetchRequestUtil {

  static uuid(): string {
    return `${Date.now()}-${Math.random()}-${process.pid}`.replace(/[.]/, '-');
  }

  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static getMultipartRequest(chunks: MultiPart[]): { body: Buffer, headers: Record<string, string> } {
    const boundary = `-------------------------multipart-${this.uuid()}`;


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

  static flattenPaths(data: Record<string, unknown> | string | boolean | number | Date, prefix: string = ''): Record<string, unknown> {
    if (!this.isPlainObject(data) && !Array.isArray(data)) {
      if (data !== undefined && data !== '' && data !== null) {
        return { [prefix]: data };
      } else {
        return {};
      }
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = prefix ? `${prefix}.${key}` : key;
      if (this.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, pre)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (this.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}]`));
          } else if (v !== undefined && v !== '' && data !== null) {
            out[`${pre}[${i}]`] = v;
          }
        }
      } else if (value !== undefined && value !== '' && value !== null) {
        out[pre] = value;
      }
    }
    return out;
  }

  static buildRequestShape(
    cfg: IFetchService,
    method: FetchRequestShape['method'],
    endpointPath: string,
    params: unknown[],
    paramConfigs: ParamConfig[] | (readonly ParamConfig[])
  ): FetchRequestShape {
    let resolvedPath = `${cfg.basePath}/${cfg.routePath}/${endpointPath || ''}`.replace(/[\/]+/g, '/').replace(/[\/]$/, '');
    const query: Record<string, string> = {};
    const headers: Record<string, string> = { ...cfg.headers };
    const bodyIdxs: number[] = [];
    for (let i = 0; i < paramConfigs.length; i++) {
      const loc = paramConfigs[i].location;
      if ((loc === 'header' || loc === 'query') && params[i] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const sub = this.flattenPaths(params[i] as string, paramConfigs[i].complex ? paramConfigs[i].key : paramConfigs[i].name);
        if (loc === 'header') {
          Object.assign(headers, sub);
        } else {
          Object.assign(query, sub);
        }
      } else if (loc === 'path') {
        resolvedPath = resolvedPath.replace(`:${paramConfigs[i].name}`, `${params[i]}`);
      } else if (loc === 'body') {
        if (params[i] !== undefined) {
          bodyIdxs.push(i);
        }
      }
    }

    const url = new URL(resolvedPath);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, `${v}`);
    }

    let body: BodyInit | undefined;

    if (bodyIdxs.length) {
      const parts: MultiPart[] = [];

      for (const bodyIdx of bodyIdxs) {
        const bodyParam = paramConfigs[bodyIdx];
        const pName = bodyParam.name;
        if (bodyParam.binary) {
          if (bodyParam.array) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            parts.push(...(params[bodyIdx] as UploadContent[]).map((uc, i) => ({
              ...uc,
              name: `${pName}[${i}]`
            })));
          } else {
            parts.push({
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              ...params[bodyIdx] as UploadContent,
              name: pName
            });
          }
        } else {
          parts.push({
            buffer: Buffer.from(JSON.stringify(params[bodyIdx])),
            type: 'application/json',
            name: pName
          });
        }
      }
      if (parts.length === 1) {
        if (parts[0].type) {
          headers['Content-Type'] = parts[0].type;
        }
        body = parts[0].buffer;
      } else {
        const sub = this.getMultipartRequest(parts);
        body = sub.body;
        Object.assign(headers, sub.headers);
      }
    }

    return { headers, url, body, method };
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
    } else if (this.isPlainObject(err)) {
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

  static async callFetch<T>(svc: IFetchService, req: FetchRequestShape): Promise<T> {
    try {
      for (const el of svc.preRequestHandlers) {
        req = await el(req) ?? req;
      }

      let resolved = await fetch(req.url, req);

      for (const el of svc.postResponseHandlers) {
        resolved = await el(resolved) ?? resolved;
      }

      if (resolved.ok) {
        if (resolved.headers.get('content-type') === 'application/json') {
          const res = await resolved.json();
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return res as Promise<T>;
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return undefined as unknown as Promise<T>;
        }
      } else {
        let res;
        if (resolved.headers.get('content-type') === 'application/json') {
          res = await resolved.json();
        } else {
          res = resolved;
        }
        throw await this.getError(res);
      }
    } catch (err) {
      if (err instanceof Error) {
        throw await this.getError(err);
      } else {
        throw err;
      }
    }
  }

  static async makeRequest<T>(
    svc: IFetchService,
    method: FetchRequestShape['method'],
    endpointPath: string,
    params: unknown[],
    paramConfigs: ParamConfig[] | (readonly ParamConfig[])
  ): Promise<T> {
    return this.callFetch(svc, this.buildRequestShape(svc, method, endpointPath, params, paramConfigs));
  }
}