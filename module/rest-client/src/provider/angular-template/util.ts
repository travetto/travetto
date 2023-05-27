/// <reference lib="dom" />


import { IAngularRequestShape, IAngularService, ParamConfig } from './types';

// @ts-ignore
import type { HttpResponse, HttpEvent } from '@angular/common/http';
// @ts-ignore
import type { Observable } from 'rxjs';
import { CommonUtil } from './common';

type Chunk = { name: string, blob: Blob };

type RequestOptions = {
  svc: IAngularService;
  method: IAngularRequestShape['method'];
  endpointPath: string;
  params: unknown[];
  paramConfig: ParamConfig[] | (readonly ParamConfig[]);
};

/**
 * Fetch utilities
 */
export class AngularRequestUtil {

  static buildRequestShape(
    cfg: IAngularService,
    method: IAngularRequestShape['method'],
    endpointPath: string,
    params: unknown[],
    paramConfigs: ParamConfig[] | (readonly ParamConfig[])
  ): IAngularRequestShape {
    let resolvedPath = `${cfg.basePath}/${cfg.routePath}/${endpointPath || ''}`.replace(/[\/]+/g, '/').replace(/[\/]$/, '');
    const query: Record<string, string> = {};
    const headers: Record<string, string> = { ...cfg.headers };
    const bodyIdxs: number[] = [];
    for (let i = 0; i < paramConfigs.length; i++) {
      const loc = paramConfigs[i].location;
      if ((loc === 'header' || loc === 'query') && params[i] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const sub = CommonUtil.flattenPaths(params[i] as string, paramConfigs[i].complex ? paramConfigs[i].key : paramConfigs[i].name);
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

    let body: unknown | undefined;

    if (bodyIdxs.length) {
      const parts: Chunk[] = [];

      for (const bodyIdx of bodyIdxs) {
        const bodyParam = paramConfigs[bodyIdx];
        const pName = bodyParam.name;
        if (bodyParam.binary) {
          if (bodyParam.array) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            parts.push(...(params[bodyIdx] as Blob[]).map((uc, i) => ({
              name: `${pName}[${i}]`,
              blob: uc
            })));
          } else {
            parts.push({
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              blob: params[bodyIdx] as Blob,
              name: pName
            });
          }
        } else {
          parts.push({
            blob: new Blob([
              JSON.stringify(params[bodyIdx])
            ], { type: 'application/json' }),
            name: pName
          });
        }
      }
      if (parts.length === 1) {
        body = parts[0].blob;
      } else {
        const form = body = new FormData();
        for (const { name, blob } of parts) {
          form.append(name, blob, 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined);
        }
      }
    }

    return { headers, url, body, method };
  }

  static getError(err: Error | Response): Error {
    if (err instanceof Error) {
      return err;
    } else if (CommonUtil.isPlainObject(err)) {
      const out = new Error();
      Object.assign(out, err);
      return out;
    } else if (err) {
      const out = new Error(err.statusText);
      Object.assign(out, { status: err.status });
      return out;
    } else {
      return new Error('Unknown error');
    }
  }

  static makeRequest<K extends 'response' | 'events' | 'body'>(
    observe: K, {
      svc, method,
      endpointPath, params, paramConfig
    }: RequestOptions): Observable<unknown> {
    const obj = this.buildRequestShape(svc, method, endpointPath, params, paramConfig);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = svc.client.request(method.toLowerCase() as 'get', obj.url.toString(), {
      headers: obj.headers,
      reportProgress: observe === 'events',
      withCredentials: svc.withCredentials,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      observe,
      body: obj.body,
    });
    return res;
  }

  static makeRequestResponse<T>(opts: RequestOptions): Observable<HttpResponse<T>> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.makeRequest('response', opts) as Observable<HttpResponse<T>>;
  }

  static makeRequestBody<T>(opts: RequestOptions): Observable<T> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.makeRequest('body', opts) as Observable<T>;
  }

  static makeRequestEvents<T>(opts: RequestOptions): Observable<HttpEvent<T>> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.makeRequest('events', opts) as Observable<HttpEvent<T>>;
  }
}