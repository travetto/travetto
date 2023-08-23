// #IF_NODE_FETCH: import fetch, { BodyInit, Response } from 'node-fetch';
import { BaseRemoteService, RequestDefinition } from './types';
import { CommonUtil } from './util';

export abstract class BaseNodeFetchService extends BaseRemoteService<BodyInit, Response> {
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
    }
    return CommonUtil.consumeError(err);
  };

  consumeJSON = <T>(text: string): T => CommonUtil.consumeJSON(text);
  makeRequest<T>(params: unknown[], cfg: RequestDefinition): Promise<T> {
    return CommonUtil.fetchRequest<T, BodyInit, Response>(this, CommonUtil.buildRequest(this, params, cfg), fetch);
  }
}