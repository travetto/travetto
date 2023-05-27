// @ts-ignore
import type { HttpResponse, HttpEvent, HttpClient } from '@angular/common/http';
// @ts-ignore
import type { Observable, OperatorFunction } from 'rxjs';

import { IRemoteService } from './common';

export interface IAngularService extends IRemoteService {
  client: HttpClient;
  transform: <T>() => OperatorFunction<T, T>;
  withCredentials?: boolean;
}

export type IAngularServiceConfig = Partial<Omit<IAngularService, 'routePath' | 'client'>>;

export class Configuration implements IAngularServiceConfig {
  constructor(cfg: IAngularServiceConfig) {
    Object.assign(this, cfg);
  }
}

export type AngularResponse<T> = Observable<T> & { events: Observable<HttpEvent<T>>, response: Observable<HttpResponse<T>> };