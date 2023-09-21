// #IF_NODE_FETCH: import FormData from 'form-data';
// #IF_NODE_FETCH: import fetch, { RequestInit, Response } from 'node-fetch';
// #IF_NODE_FETCH: import Blob = require('fetch-blob');
import { IRemoteService, ParamConfig, RequestDefinition, RequestOptions } from './types';

function isResponse(v: unknown): v is Response {
  // @ts-expect-error
  return v && v.status && v.headers;
}

type BodyPart = { param: unknown, config: ParamConfig };

export class CommonUtil {
  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static flattenPaths(data: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = `${prefix}${key}`;
      if (this.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, `${pre}.`)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (this.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}].`));
          } else {
            out[`${pre}[${i}]`] = v ?? '';
          }
        }
      } else {
        out[pre] = value ?? '';
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

  static requestBody<T>(body: BodyPart[]): { body: T, headers: Record<string, string> } | undefined {
    if (!body.length) {
      return undefined;
    }

    const parts: { name: string, blob: Blob }[] = [];

    for (const { param, config } of body) {
      const pName = config.name;
      if (config.binary) {
        if (config.array) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          parts.push(...(param as Blob[]).map((uc, i) => ({ name: `${pName}[${i}]`, blob: uc })));
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          parts.push({ name: pName, blob: param as Blob });
        }
      } else {
        parts.push({ name: pName, blob: new Blob([JSON.stringify(param)], { type: 'application/json' }) });
      }
    }
    if (body.length === 1) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const blob: Blob = parts[0].blob;
      return {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        body: blob as T,
        headers: 'name' in blob ? {
          'Content-Disposition': `inline; filename="${blob.name}"`
        } : {}
      };
    } else {
      const form = new FormData();
      for (const { name, blob } of parts) {
        form.append(name, blob, 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined);
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return { body: form as T, headers: {} };
    }
  }

  static buildRequest<T, R = unknown>(svc: IRemoteService<T, R>, params: unknown[], def: RequestDefinition): RequestOptions<T> {
    const { endpointPath, paramConfigs, method } = def;

    let resolvedPath = `${svc.baseUrl}/${svc.routePath}/${endpointPath || ''}`.replace(/[\/]+/g, '/').replace(/[\/]$/, '');
    const query: Record<string, string> = {};
    const headers: Record<string, string> = { ...svc.headers };
    const body: BodyPart[] = [];
    for (let i = 0; i < paramConfigs.length; i++) {
      const { location: loc, prefix, complex, name } = paramConfigs[i];
      if ((loc === 'header' || loc === 'query') && params[i] !== undefined) {
        const sub = this.flattenPaths(
          (prefix || !complex) ?
            { [prefix ?? name]: params[i] } :
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            params[i] as Record<string, unknown>
        );
        if (loc === 'header') {
          Object.assign(headers, sub);
        } else {
          Object.assign(query, sub);
        }
      } else if (loc === 'path') {
        resolvedPath = resolvedPath.replace(`:${paramConfigs[i].name}`, `${params[i]}`);
      } else if (loc === 'body') {
        if (params[i] !== undefined) {
          body.push({ param: params[i], config: paramConfigs[i] });
        }
      }
    }

    const url = new URL(resolvedPath);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, `${v}`);
    }

    const { headers: requestHeaders, body: requestBody } = this.requestBody<T>(body) || {};

    return {
      headers: { ...headers, ...requestHeaders },
      url,
      method,
      body: requestBody,
      withCredentials: svc.withCredentials,
      timeout: svc.timeout
    };
  }

  static consumeError(err: Error | Response): Error {
    if (err instanceof Error) {
      return err;
    } else if (isResponse(err)) {
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

  static async fetchRequest<T, B, R extends Response>(
    svc: IRemoteService<B, R>,
    req: RequestOptions<B>,
    fetcher: (typeof fetch)
  ): Promise<T> {
    try {
      for (const el of svc.preRequestHandlers) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        req = (await el(req) ?? req) as RequestOptions<B>;
      }

      if (svc.debug) {
        console.debug('Making request:', req.url.pathname);
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const fetchInit = req as RequestInit;
      fetchInit.credentials = req.withCredentials ? 'include' : 'same-origin'; // #NOT_NODE_FETCH
      if (req.timeout) {
        const controller = new AbortController();
        fetchInit.signal = controller.signal;
        const timer = setTimeout(() => controller.abort(), req.timeout);
        controller.signal.onabort = (): void => { timer && clearTimeout(timer); };
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      let resolved: R = await (fetcher(req.url, fetchInit) as unknown as Promise<R>);

      for (const el of svc.postResponseHandlers) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolved = (await el(resolved) ?? resolved) as unknown as R;
      }

      const contentType = resolved.headers.get('content-type')?.split(';')[0];

      if (resolved.ok) {
        const text = await resolved.text();
        if (contentType === 'application/json') {
          return svc.consumeJSON<T>(text);
        } else if (contentType === 'text/plain') {
          try {
            return svc.consumeJSON<T>(text);
          } catch {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            return text as unknown as Promise<T>;
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return text as unknown as Promise<T>;
        }
      } else {
        let res;
        if (contentType === 'application/json') {
          const text = await resolved.text();
          res = svc.consumeJSON<Error>(text);
        } else {
          res = resolved;
        }
        if (svc.debug) {
          console.debug('Error in making request:', req.url.pathname, res);
        }
        throw await svc.consumeError(res);
      }
    } catch (err) {
      if (svc.debug) {
        console.debug('Error in initiating request:', req.url.pathname, err);
      }
      if (err instanceof Error) {
        throw await svc.consumeError(err);
      } else {
        throw err;
      }
    }
  }
}