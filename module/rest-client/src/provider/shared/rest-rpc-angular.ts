// #UNCOMMENT import { Observable, catchError, map, timeout } from 'rxjs';
// #UNCOMMENT import type { HttpClient } from '@angular/common/http';

import { ClientOptions, parseBody } from './rest-rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFn = (...args: any) => Promise<unknown>;
type PromiseRes<V extends PromiseFn> = Awaited<ReturnType<V>>;

// @ts-ignore
export function angularFactoryDecorator(service: { http: HttpClient }) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return function (opts: ClientOptions) {
    return {
      // @ts-ignore
      $<V extends PromiseFn>(this: V, ...params: Parameters<V>): Observable<PromiseRes<V>> {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return service.http.request(opts.request!.method! as 'get', opts.url, {
          body: params,
          headers: opts.request?.headers,
          withCredentials: true,
          responseType: 'text',
          reportProgress: false
        }).pipe(
          // @ts-ignore
          map(parseBody<PromiseRes<V>>),
          // @ts-ignore
          timeout(opts.timeout ?? (1000 * 60 ** 2)),
          // @ts-ignore
          catchError((v: unknown) => {
            const err = new Error();
            if (typeof v === 'object' && !!v && 'error' in v && typeof v.error === 'object' && !!v.error) {
              Object.assign(err, v.error);
            }
            throw err;
          })
        );
      }
    };
  };
}