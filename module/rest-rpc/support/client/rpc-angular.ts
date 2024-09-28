// #UNCOMMENT import { Observable, catchError, mergeMap, timeout } from 'rxjs';
// #UNCOMMENT import type { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { type RpcRequest, consumeError, consumeJSON } from './rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFn = (...args: any) => Promise<unknown>;
type PromiseRes<V extends PromiseFn> = Awaited<ReturnType<V>>;

// @ts-ignore
export function angularFactoryDecorator(service: { http: HttpClient }) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return function (opts: RpcRequest) {
    return {
      // @ts-ignore
      $<V extends PromiseFn>(this: V, ...params: Parameters<V>): Observable<PromiseRes<V>> {
        const readError = opts.consumeError ?? consumeError;
        const readJSON = opts.consumeJSON ?? consumeJSON;

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return service.http.request(opts.core!.method! as 'get', opts.url.toString(), {
          body: params,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          headers: opts.core?.headers as Record<string, string>,
          withCredentials: opts.core?.credentials === 'include',
          responseType: 'text',
          reportProgress: false
        }).pipe(
          // @ts-ignore
          mergeMap(
            async (v: unknown) => (await readJSON<PromiseRes<V>>(v))!
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