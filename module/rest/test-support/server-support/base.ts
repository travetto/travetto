import { Request } from '@travetto/rest/src/types';

import { ServerHandle } from '../..';

export type MakeRequestConfig<T> = {
  query?: Record<string, string>;
  body?: T;
  headers?: Record<string, string | undefined>;
};

export type MakeRequestResponse<T> = {
  status: number;
  body: T;
  headers: Record<string, string | undefined>;
};

export interface RestServerSupport {
  init(): Promise<ServerHandle>;
  execute(method: Request['method'], path: string, cfg?: MakeRequestConfig<Buffer>): Promise<MakeRequestResponse<Buffer>>;
}