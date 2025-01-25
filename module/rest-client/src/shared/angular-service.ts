// #UNCOMMENT import type { HttpResponse, HttpEvent, HttpClient } from '@angular/common/http';
// #UNCOMMENT import { Observable, map } from 'rxjs';
// #UNCOMMENT import { timeout } from 'rxjs/operators';

import { BaseRemoteService, IRemoteService, IRemoteServiceConfig, RequestDefinition, RequestOptions } from './types';
import { CommonUtil, restCast } from './util';

// @ts-ignore
export type AngularResponse<T> = Observable<T> & { events: Observable<HttpEvent<T>>, response: Observable<HttpResponse<T>> };

export type IAngularServiceConfig = Partial<IRemoteService<unknown, AngularResponse<unknown>>>;

export class Configuration implements IAngularServiceConfig {
  constructor(cfg: IAngularServiceConfig) {
    Object.assign(this, cfg);
  }
}

export abstract class BaseAngularService extends BaseRemoteService<RequestInit, Response> {

  // @ts-ignore
  client: HttpClient;

  // @ts-ignore
  constructor(client: HttpClient, cfg: IRemoteServiceConfig<RequestInit, Response>) {
    super(cfg);
    this.client = client;
  }

  consumeJSON<T>(text: string | unknown): T {
    return CommonUtil.consumeJSON(text);
  }

  invoke<T>(req: RequestOptions, observe: 'response' | 'events' | 'body'): AngularResponse<T> {
    let ngReq = this.client.request(restCast(req.method.toLowerCase()), req.url.toString(), {
      observe, reportProgress: observe === 'events',
      withCredentials: req.withCredentials,
      headers: req.headers, body: req.body,
    });

    if (req.timeout) {
      // @ts-ignore
      ngReq = ngReq.pipe(timeout(req.timeout));
    }

    // @ts-ignore
    return restCast(ngReq.pipe(map((v: unknown) => this.consumeJSON(v))));
  }

  makeRequest<T>(params: unknown[], opts: RequestDefinition): AngularResponse<T> {
    const req = CommonUtil.buildRequest(this, params, opts);
    const res = this.invoke<T>(req, 'body');
    Object.defineProperties(res, {
      events: { get: () => this.invoke(req, 'events'), configurable: false },
      response: { get: () => this.invoke(req, 'response'), configurable: false }
    });

    return restCast(res);
  }
}