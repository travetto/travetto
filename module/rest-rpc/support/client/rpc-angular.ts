// #UNCOMMENT import { Observable, catchError, mergeMap, timeout } from 'rxjs';
// #UNCOMMENT import type { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { type RemoteRequest, consumeError, consumeJSON } from './rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFn = (...args: any) => Promise<unknown>;
type PromiseRes<V extends PromiseFn> = Awaited<ReturnType<V>>;

// @ts-ignore
export function angularFactoryDecorator(service: { http: HttpClient }) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return function (opts: RemoteRequest<RequestInit, Response>) {
    return {
      // @ts-ignore
      $<V extends PromiseFn>(this: V, ...params: Parameters<V>): Observable<PromiseRes<V>> {
        const readError = opts.consumeError ?? consumeError;
        const readJSON = opts.consumeJSON ?? consumeJSON;

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return service.http.request(opts.core!.method! as 'get', opts.url, {
          body: params,
          headers: opts.core?.headers,
          withCredentials: opts.core?.credentials === 'include',
          responseType: 'text',
          reportProgress: false
        }).pipe(
          // @ts-ignore
          mergeMap(
            readJSON<PromiseRes<V>>
          ),
          // @ts-ignore
          timeout(
            opts.timeout || (1000 * 60 ** 2)
          ),
          // @ts-ignore
          catchError((v: HttpErrorResponse) => {
            throw readError(v.error);
          })
        );
      }
    };
  };
}