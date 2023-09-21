import { BaseRemoteService, IRemoteServiceConfig, PostResponseHandler, PreRequestHandler, RequestDefinition } from './types';
import { CommonUtil } from './util';

function isResponse(v: unknown): v is Response {
  // @ts-expect-error
  return v && v.status && v.headers;
}

export abstract class BaseFetchService extends BaseRemoteService<BodyInit, Response> {

  postResponseHandlers: PostResponseHandler<Response>[];
  preRequestHandlers: PreRequestHandler<BodyInit>[];

  constructor(cfg: IRemoteServiceConfig<BodyInit, Response> & {
    postResponseHandlers?: PostResponseHandler<Response>[];
    preRequestHandlers?: PreRequestHandler<BodyInit>[];
  }) {
    super(cfg);
    this.postResponseHandlers = cfg.postResponseHandlers ?? [];
    this.preRequestHandlers = cfg.preRequestHandlers ?? [];
  }

  consumeError = async (err: Error | Response): Promise<Error> => {
    if (err instanceof Error) {
      try {
        // @ts-ignore
        const { AppError } = await import('@travetto/base');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        const ae = (err as any);
        if ('message' in ae && 'category' in ae) {
          return new AppError(ae.message, ae.category, ae.payload);
        }
      } catch { }
      return err;
    } else if (isResponse(err)) {
      const out = new Error(err.statusText);
      Object.assign(out, { status: err.status });
      return this.consumeError(out);
    } else if (CommonUtil.isPlainObject(err)) {
      const out = new Error();
      Object.assign(out, err);
      return this.consumeError(out);
    } else {
      return new Error('Unknown error');
    }
  };

  consumeJSON<T>(val: string): T {
    return CommonUtil.consumeJSON<T>(val);
  }

  async makeRequest<T>(params: unknown[], cfg: RequestDefinition): Promise<T> {
    let req = CommonUtil.buildRequest<BodyInit, Response>(this, params, cfg);

    try {
      for (const fn of this.preRequestHandlers) {
        req = await fn(req) ?? req;
      }

      if (this.debug) {
        console.debug('Making request:', req.url.pathname);
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const fetchInit = req as RequestInit;
      fetchInit.credentials = req.withCredentials ? 'include' : 'same-origin';
      if (req.timeout) {
        const controller = new AbortController();
        fetchInit.signal = controller.signal;
        const timer = setTimeout(() => controller.abort(), req.timeout);
        controller.signal.onabort = (): void => { timer && clearTimeout(timer); };
      }

      let resolved = await fetch(req.url, fetchInit);

      for (const fn of this.postResponseHandlers) {
        resolved = await fn(resolved) ?? resolved;
      }

      const contentType = resolved.headers.get('content-type')?.split(';')[0];

      if (resolved.ok) {
        const text = await resolved.text();
        if (contentType === 'application/json') {
          return this.consumeJSON<T>(text);
        } else if (contentType === 'text/plain') {
          try {
            return this.consumeJSON<T>(text);
          } catch {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            return text as unknown as Promise<T>;
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return text as unknown as Promise<T>;
        }
      } else {
        let res;
        if (contentType === 'application/json') {
          const text = await resolved.text();
          res = this.consumeJSON<Error>(text);
        } else {
          res = resolved;
        }
        if (this.debug) {
          console.debug('Error in making request:', req.url.pathname, res);
        }
        throw await this.consumeError(res);
      }
    } catch (err) {
      if (this.debug) {
        console.debug('Error in initiating request:', req.url.pathname, err);
      }
      if (err instanceof Error) {
        throw await this.consumeError(err);
      } else {
        throw err;
      }
    }
  }
}