export type ParamConfig = {
  sourceText?: string;
  location: 'header' | 'body' | 'path' | 'query';
  array?: boolean;
  binary?: boolean;
  name: string;
  prefix?: string;
  complex?: boolean;
  description?: string;
};

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'head' | 'options' | 'patch';


export type RequestDefinition = {
  method: HttpMethod;
  endpointPath: string;
  paramConfigs: ParamConfig[] | (readonly ParamConfig[]);
};

type OrProm<X> = X | Promise<X>;

export type RequestOptions<T = unknown> = {
  headers: Record<string, string>;
  url: URL;
  body?: T;
  method: HttpMethod;
  timeout?: number;
  withCredentials?: boolean;
};

export type PreRequestHandler<B> = (req: RequestOptions<B>) => OrProm<RequestOptions<B> | undefined | void>;
export type PostResponseHandler<R> = (res: R) => OrProm<R | undefined | void>;

export type IRemoteServiceConfig<B, R> = Partial<Omit<IRemoteService<B, R>, 'routePath'>>;

export type IRemoteService<B, R> = {
  debug?: boolean;
  timeout?: number;
  withCredentials?: boolean;
  baseUrl: string;
  routePath: string;
  headers: Record<string, string>;
  consumeJSON: <T>(text: string) => T;
};

export abstract class BaseRemoteService<B, R> implements IRemoteService<B, R> {

  debug?: boolean;
  baseUrl: string;
  headers: Record<string, string>;
  withCredentials?: boolean;
  timeout?: number;
  abstract consumeJSON<T>(text: string): T;

  abstract get routePath(): string;

  constructor(cfg: IRemoteServiceConfig<B, R>) {
    this.baseUrl = cfg.baseUrl ?? 'http://localhost';
    this.headers = cfg.headers ?? {};
    this.withCredentials = cfg.withCredentials ?? false;
    this.timeout = cfg.timeout;
    this.debug = cfg.debug;
  }
}