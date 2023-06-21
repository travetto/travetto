export type ParamConfig = {
  location: 'header' | 'body' | 'path' | 'query';
  array?: boolean;
  binary?: boolean;
  name: string;
  prefix?: string;
  complex?: boolean;
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
};

export type PreRequestHandler<B> = (req: RequestOptions<B>) => OrProm<RequestOptions<B> | undefined | void>;
export type PostResponseHandler<R> = (res: R) => OrProm<R | undefined | void>;

export type IRemoteServiceConfig<B, R> = Partial<Omit<IRemoteService<B, R>, 'routePath'>>;

export type IRemoteService<B, R> = {
  debug?: boolean;
  withCredentials?: boolean;
  baseUrl: string;
  routePath: string;
  headers: Record<string, string>;
  preRequestHandlers: PreRequestHandler<B>[];
  postResponseHandlers: PostResponseHandler<R>[];
  consumeError: (err: Error | R) => Error | Promise<Error>;
  consumeJSON: <T>(text: string) => T;
};

export abstract class BaseRemoteService<B, R> implements IRemoteService<B, R> {

  baseUrl: string;
  preRequestHandlers: PreRequestHandler<B>[];
  postResponseHandlers: PostResponseHandler<R>[];
  headers: Record<string, string>;
  withCredentials?: boolean;

  consumeJSON!: <T>(text: string) => T;
  consumeError!: (err: Error | R) => Error | Promise<Error>;

  abstract get routePath(): string;

  constructor(cfg: IRemoteServiceConfig<B, R>) {
    this.baseUrl = cfg.baseUrl ?? 'http://localhost';
    this.postResponseHandlers = cfg.postResponseHandlers ?? [];
    this.preRequestHandlers = cfg.preRequestHandlers ?? [];
    this.headers = cfg.headers ?? {};
    this.withCredentials = cfg.withCredentials ?? false;
  }
}