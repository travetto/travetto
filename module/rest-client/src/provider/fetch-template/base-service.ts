import { IFetchService, IFetchServiceConfig, PostResponseHandler, PreRequestHandler } from './types';

export abstract class BaseFetchService implements IFetchService {

  basePath: string;
  preRequestHandlers: PreRequestHandler[];
  postResponseHandlers: PostResponseHandler[];
  headers: Record<string, string>;

  abstract get routePath(): string;

  constructor(cfg: IFetchServiceConfig) {
    this.basePath = cfg.basePath ?? 'http://localhost';
    this.postResponseHandlers = cfg.postResponseHandlers ?? [];
    this.preRequestHandlers = cfg.preRequestHandlers ?? [];
    this.headers = cfg.headers ?? {};
  }
}