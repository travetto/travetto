/// <reference lib="dom" />
import { CommonUtil, RawRequestOptions, RequestOptions } from './common';
import { AngularResponse, IAngularService } from './types';

type Chunk = { name: string, blob: Blob };

/**
 * Fetch utilities
 */
export class AngularRequestUtil {

  static buildRequestShape(params: unknown[], cfg: RequestOptions<IAngularService>): RawRequestOptions<IAngularService> {
    return CommonUtil.buildRequest<IAngularService, unknown, Blob, Chunk>(params, cfg, {
      addItem: (name, blob) => ({ name, blob }),
      addJson: (name, json) => ({ name, blob: new Blob([JSON.stringify(json)], { type: 'application/json' }) }),
      finalize(items) {
        if (items.length === 1) {
          return items[0].blob;
        } else {
          const form = new FormData();
          for (const { name, blob } of items) {
            form.append(name, blob, 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined);
          }
          return form;
        }
      }
    });
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

  static invoke<T>(req: RawRequestOptions<IAngularService>, observe: 'response' | 'events' | 'body'): AngularResponse<T> {
    const svc = req.svc;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return svc.client.request(req.method.toLowerCase() as 'get', req.url.toString(), {
      observe, reportProgress: observe === 'events',
      withCredentials: svc.withCredentials,
      headers: req.headers, body: req.body,
    }).pipe(svc.transform<T>()) as AngularResponse<T>;
  }

  static makeRequest<T>(params: unknown[], opts: RequestOptions<IAngularService>): AngularResponse<T> {
    const req = this.buildRequestShape(params, opts);
    const res = this.invoke<T>(req, 'body');
    Object.defineProperties(res, {
      events: { get: () => this.invoke(req, 'events'), configurable: false },
      response: { get: () => this.invoke(req, 'response'), configurable: false }
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return res as AngularResponse<T>;
  }
}