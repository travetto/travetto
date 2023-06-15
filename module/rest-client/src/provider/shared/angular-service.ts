/// <reference lib="dom" />

// @ts-ignore
import type { HttpResponse, HttpEvent, HttpClient } from '@angular/common/http';
// @ts-ignore
import type { Observable, OperatorFunction } from 'rxjs';

import { BaseRemoteService, IRemoteService, RequestDefinition, RequestOptions } from './types';
import { CommonUtil } from './util';

type Chunk = { name: string, blob: Blob };

export type AngularResponse<T> = Observable<T> & { events: Observable<HttpEvent<T>>, response: Observable<HttpResponse<T>> };

export type IAngularServiceConfig = Partial<IRemoteService<unknown, AngularResponse<unknown>>>;

export class Configuration implements IAngularServiceConfig {
  constructor(cfg: IAngularServiceConfig) {
    Object.assign(this, cfg);
  }
}

export abstract class BaseAngularService extends BaseRemoteService<BodyInit, Response>  {

  abstract get transform(): <T>() => OperatorFunction<T, T>;
  abstract get client(): HttpClient;

  consumeError = (err: Error | Response): Error => CommonUtil.consumeError(err);
  consumeJSON = <T>(text: string): T => CommonUtil.consumeJSON(text);

  buildRequestShape(params: unknown[], cfg: RequestDefinition): RequestOptions {
    return CommonUtil.buildRequest<BodyInit, Blob, Chunk, Response>(this, params, cfg, {
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

  invoke<T>(req: RequestOptions, observe: 'response' | 'events' | 'body'): AngularResponse<T> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.client.request(req.method.toLowerCase() as 'get', req.url.toString(), {
      observe, reportProgress: observe === 'events',
      withCredentials: this.withCredentials,
      headers: req.headers, body: req.body,
    }).pipe(this.transform<T>()) as AngularResponse<T>;
  }

  makeRequest<T>(params: unknown[], opts: RequestDefinition): AngularResponse<T> {
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