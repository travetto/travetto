import { IRemoteService, MultipartHandler, RequestDefinition, RequestOptions } from './types';

type FetchResponseLite = {
  ok?: boolean;
  statusText?: string;
  status?: number;
  headers: { get(key: string): string | null };
  text(): Promise<string>;
};
type FetchLike<B, R extends FetchResponseLite> = (url: string | URL, opts: RequestOptions<B>) => R | Promise<R>;

function isResponseLite(v: unknown): v is FetchResponseLite {
  // @ts-expect-error
  return v && v.status && v.headers;
}

export class CommonUtil {
  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
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

  static consumeJSON<T>(text: string | unknown): T {
    if (typeof text !== 'string') {
      return this.consumeJSON(JSON.stringify(text));
    }
    return JSON.parse(text, (key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z/.test(value)) {
        return new Date(value);
      } else {
        return value;
      }
    });
  }

  static buildRequest<T, B, P, R = unknown>(
    svc: IRemoteService<T, R>, params: unknown[], { endpointPath, paramConfigs, method }: RequestDefinition, multipart: MultipartHandler<T, B, P>
  ): RequestOptions<T> {
    let resolvedPath = `${svc.baseUrl}/${svc.routePath}/${endpointPath || ''}`.replace(/[\/]+/g, '/').replace(/[\/]$/, '');
    const query: Record<string, string> = {};
    const headers: Record<string, string> = { ...svc.headers };
    const bodyIdxs: number[] = [];
    for (let i = 0; i < paramConfigs.length; i++) {
      const loc = paramConfigs[i].location;
      if ((loc === 'header' || loc === 'query') && params[i] !== undefined) {
        const prefix = paramConfigs[i].prefix ?? (!paramConfigs[i].complex ? paramConfigs[i].name : '');
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const sub = this.flattenPaths(params[i] as string, prefix);
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

    let body: T | undefined;

    const req: RequestOptions<T> = { headers, url, body, method };

    if (bodyIdxs.length) {
      const parts: P[] = [];

      for (const bodyIdx of bodyIdxs) {
        const bodyParam = paramConfigs[bodyIdx];
        const pName = bodyParam.name;
        if (bodyParam.binary) {
          if (bodyParam.array) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            parts.push(...(params[bodyIdx] as B[]).map((uc, i) =>
              multipart.addItem(`${pName}[${i}]`, uc)
            ));
          } else {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            parts.push(multipart.addItem(pName, params[bodyIdx] as B));
          }
        } else {
          parts.push(multipart.addJson(pName, params[bodyIdx]));
        }
      }
      req.body = multipart.finalize(parts, req);
    }
    return req;
  }

  static consumeError(err: Error | FetchResponseLite): Error {
    if (err instanceof Error) {
      return err;
    } else if (isResponseLite(err)) {
      const out = new Error(err.statusText);
      Object.assign(out, { status: err.status });
      return this.consumeError(out);
    } else if (CommonUtil.isPlainObject(err)) {
      const out = new Error();
      Object.assign(out, err);
      return this.consumeError(out);
    } else {
      return new Error('Unknown error');
    }
  }

  static async fetchRequest<T, B, R extends FetchResponseLite>(
    svc: IRemoteService<B, R>,
    req: RequestOptions<B>,
    fetcher: FetchLike<B, R>
  ): Promise<T> {
    try {
      for (const el of svc.preRequestHandlers) {
        req = await el(req) ?? req;
      }

      if (svc.debug) {
        console.debug('Making request', req);
      }

      let resolved = await fetcher(req.url, req);

      for (const el of svc.postResponseHandlers) {
        resolved = await el(resolved) ?? resolved;
      }

      if (resolved.ok) {
        if (resolved.headers.get('content-type') === 'application/json') {
          const text = await resolved.text();
          return svc.consumeJSON<T>(text);
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return undefined as unknown as Promise<T>;
        }
      } else {
        let res;
        if (resolved.headers.get('content-type') === 'application/json') {
          const text = await resolved.text();
          res = svc.consumeJSON<Error>(text);
        } else {
          res = resolved;
        }
        if (svc.debug) {
          console.debug('Error in making request', res);
        }
        throw await svc.consumeError(res);
      }
    } catch (err) {
      if (svc.debug) {
        console.debug('Error in initiating request', err);
      }
      if (err instanceof Error) {
        throw await svc.consumeError(err);
      } else {
        throw err;
      }
    }
  }
}