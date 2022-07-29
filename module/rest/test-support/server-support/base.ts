import { Headers } from 'node-fetch';

import { Request } from '@travetto/rest/src/types';

import { ServerHandle } from '../..';

export type MakeRequestConfig<T> = {
  query?: Record<string, string>;
  body?: T;
  headers?: Record<string, string | string[] | undefined>;
};

export type MakeRequestResponse<T> = {
  status: number;
  body: T;
  headers: Record<string, string | string[] | undefined>;
};

export interface RestServerSupport {
  init(): Promise<ServerHandle>;
  execute(method: Request['method'], path: string, cfg?: MakeRequestConfig<Buffer>): Promise<MakeRequestResponse<Buffer>>;
}

export const headerToShape = {
  multi: (o: Headers | Record<string, string | string[] | undefined> = {}): Record<string, string[]> =>
    Object.fromEntries<string[]>(
      [...(o instanceof Headers ? o.entries() : Object.entries(o))]
        .filter((p): p is [string, string[] | string] => p[1] !== undefined && (typeof p[1] === 'string' ? true : p[1].length > 0))
        .map(([k, v]): [string, string[]] => [k, Array.isArray(v) ? v : /set-cookie/i.test(k) ? [v] : v.split(/\s*,\s*/)])
    ),
  single: (o: Record<string, string | string[] | undefined> = {}): Record<string, string> =>
    Object.fromEntries<string>(
      Object.entries(o)
        .filter((p): p is [string, string[] | string] => p[1] !== undefined && (typeof p[1] === 'string' ? true : p[1].length > 0))
        .map(([k, v]): [string, string] => [k, Array.isArray(v) ? v.join(', ') : v])
    )
};
