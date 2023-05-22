// @ts-ignore
import type { HttpClient } from '@angular/common/http';

import { IAngularService, IAngularServiceConfig } from './types';

export abstract class BaseAngularService implements IAngularService {

  basePath: string;
  headers: Record<string, string>;
  withCredentials?: boolean;

  abstract get routePath(): string;
  abstract get client(): HttpClient;

  constructor(cfg: IAngularServiceConfig) {
    this.basePath = cfg.basePath ?? 'http://localhost';
    this.headers = cfg.headers ?? {};
    this.withCredentials = cfg.withCredentials ?? false;
  }
}