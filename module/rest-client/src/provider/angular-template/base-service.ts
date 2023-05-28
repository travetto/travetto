// @ts-ignore
import type { HttpClient } from '@angular/common/http';
// @ts-ignore
import type { OperatorFunction } from 'rxjs';

import { IAngularService, IAngularServiceConfig } from './types';

export abstract class BaseAngularService implements IAngularService {

  baseUrl: string;
  headers: Record<string, string>;
  withCredentials?: boolean;

  abstract get transform(): <T>() => OperatorFunction<T, T>;
  abstract get routePath(): string;
  abstract get client(): HttpClient;

  constructor(cfg: IAngularServiceConfig) {
    this.baseUrl = cfg.baseUrl ?? 'http://localhost';
    this.headers = cfg.headers ?? {};
    this.withCredentials = cfg.withCredentials ?? false;
  }
}