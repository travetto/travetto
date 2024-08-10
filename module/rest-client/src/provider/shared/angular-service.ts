// @ts-ignore
import type { HttpResponse, HttpEvent, HttpClient } from '@angular/common/http';
// @ts-ignore
import type { Observable, OperatorFunction } from 'rxjs';

import { BaseRemoteService, IRemoteService, RequestDefinition, RequestOptions } from './types';
import { CommonUtil, RestCast } from './util';

export type AngularResponse<T> = Observable<T> & { events: Observable<HttpEvent<T>>, response: Observable<HttpResponse<T>> };

export type IAngularServiceConfig = Partial<IRemoteService<unknown, AngularResponse<unknown>>>;

export class Configuration implements IAngularServiceConfig {
  constructor(cfg: IAngularServiceConfig) {
    Object.assign(this, cfg);
  }
}

export abstract class BaseAngularService extends BaseRemoteService<RequestInit, Response> {
  abstract get transform(): <T>() => OperatorFunction<T, T>;
  abstract get client(): HttpClient;

  abstract timer<T>(delay: number): OperatorFunction<T, T>;

  consumeJSON<T>(text: string | unknown): T {
    return CommonUtil.consumeJSON(text);
  }

  invoke<T>(req: RequestOptions, observe: 'response' | 'events' | 'body'): AngularResponse<T> {
    let ngReq = this.client.request(RestCast(req.method.toLowerCase()), req.url.toString(), {
      observe, reportProgress: observe === 'events',
      withCredentials: req.withCredentials,
      headers: req.headers, body: req.body,
    });

    if (req.timeout) {
      ngReq = ngReq.pipe(this.timer<T>(req.timeout));
    }

    return RestCast(ngReq.pipe(this.transform<T>()));
  }

  makeRequest<T>(params: unknown[], opts: RequestDefinition): AngularResponse<T> {
    const req = CommonUtil.buildRequest(this, params, opts);
    const res = this.invoke<T>(req, 'body');
    Object.defineProperties(res, {
      events: { get: () => this.invoke(req, 'events'), configurable: false },
      response: { get: () => this.invoke(req, 'response'), configurable: false }
    });

    return RestCast(res);
  }
}