import { IFetchService, IFetchServiceConfig, PostResponseHandler, PreRequestHandler } from './types';

export abstract class BaseFetchService implements IFetchService {

  baseUrl: string;
  preRequestHandlers: PreRequestHandler[];
  postResponseHandlers: PostResponseHandler[];
  headers: Record<string, string>;

  abstract get routePath(): string;

  constructor(cfg: IFetchServiceConfig) {
    this.baseUrl = cfg.baseUrl ?? 'http://localhost';
    this.postResponseHandlers = cfg.postResponseHandlers ?? [];
    this.preRequestHandlers = cfg.preRequestHandlers ?? [];
    this.headers = cfg.headers ?? {};
  }
}