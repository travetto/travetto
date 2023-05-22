// @ts-ignore
import type { HttpClient } from '@angular/common/http';

export type IAngularRequestShape = {
  headers: Record<string, string>;
  url: URL;
  body?: unknown;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
};

export type IAngularService = {
  client: HttpClient;
  basePath: string;
  routePath: string;
  headers: Record<string, string>;
  withCredentials?: boolean;
};

export type IAngularServiceConfig = Partial<Omit<IAngularService, 'routePath' | 'client'>>;

export type ParamConfig = {
  location: 'header' | 'body' | 'path' | 'query';
  array?: boolean;
  binary?: boolean;
  name: string;
  key?: string;
  complex?: boolean;
};

export class Configuration implements IAngularServiceConfig {
  constructor(cfg: IAngularServiceConfig) {
    Object.assign(this, cfg);
  }
}