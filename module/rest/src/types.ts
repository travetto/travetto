export type HeaderMap = { [key: string]: (string | (() => string)) };

export type Method = 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
export type PathType = string | RegExp;

export type Request = Travetto.Request;
export type Response = Travetto.Response;

export interface TypedQuery<T> extends Request { query: T; }
export interface TypedBody<T> extends Request { body: T; }

export interface RouteConfig {
  instance?: any;
  method: Method;
  path: PathType;
  handler: Filter;
  handlerFinalized?: Filter;
}

export type Filter<T = any> = (req: Request & TypedBody<any> & TypedQuery<any>, res: Response) => T;
export type FilterReq<T = any> = (req: Request & TypedBody<any> & TypedQuery<any>) => T;
export type FilterNone<T = any> = () => T;