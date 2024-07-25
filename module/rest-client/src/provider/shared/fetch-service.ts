import { BaseRemoteService, IRemoteServiceConfig, PostResponseHandler, PreRequestHandler, RequestDefinition } from './types';
import { CommonUtil } from './util';

function isResponse(v: unknown): v is Response {
  // @ts-expect-error
  return v && v.status && v.headers;
}

export abstract class BaseFetchService extends BaseRemoteService<RequestInit, Response> {

  postResponseHandlers: PostResponseHandler<Response>[];
  preRequestHandlers: PreRequestHandler<RequestInit>[];
  retriesOnConnectFailure: number = 0;

  constructor(cfg: IRemoteServiceConfig<RequestInit, Response> & {
    postResponseHandlers?: PostResponseHandler<Response>[];
    preRequestHandlers?: PreRequestHandler<RequestInit>[];
  }) {
    super(cfg);
    this.postResponseHandlers = cfg.postResponseHandlers ?? [];
    this.preRequestHandlers = cfg.preRequestHandlers ?? [];
    this.retriesOnConnectFailure = cfg.retriesOnConnectFailure ?? 0;
  }

  // Node/Browser handling of timeout registration
  #registerTimeout<T extends (number | string | { unref(): unknown })>(
    controller: AbortController,
    timeout: number,
    start: (fn: (...args: unknown[]) => unknown, delay: number) => T,
    stop: (val: T) => void
  ): void {
    const timer = start(() => controller.abort(), timeout);
    if (!(typeof timer === 'number' || typeof timer === 'string')) {
      timer.unref();
    }
    controller.signal.onabort = (): void => { timer && stop(timer); };
  }

  consumeError = async (err: Error | Response): Promise<Error> => {
    if (err instanceof Error) {
      try {
        // @ts-ignore
        const { AppError } = await import('@travetto/runtime');
        return AppError.fromJSON(err) ?? err;
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
    let req = CommonUtil.buildRequest<RequestInit, Response>(this, params, cfg);

    try {
      for (const fn of this.preRequestHandlers) {
        const computed = await fn(req);
        if (computed) {
          req = computed;
        }
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
        // Node/Browser handling of timeout registration
        this.#registerTimeout(controller, req.timeout, setTimeout, clearTimeout);
      }

      let resolved: Response | undefined;
      for (let i = 0; i <= this.retriesOnConnectFailure; i += 1) {
        try {
          resolved = await fetch(req.url, fetchInit);
          break;
        } catch (err) {
          if (i < this.retriesOnConnectFailure) {
            if (this.debug) {
              console.debug('Retrying request on error:', req.url.pathname, err);
            }
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s
            continue;
          } else {
            throw err;
          }
        }
      }

      if (!resolved) {
        throw new Error('Unable to connect');
      }

      for (const fn of this.postResponseHandlers) {
        const computed = await fn(resolved);
        if (computed) {
          resolved = computed;
        }
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