import { BaseRemoteService, RequestDefinition } from './types';
import { CommonUtil } from './util';

export abstract class BaseWebFetchService extends BaseRemoteService<BodyInit, Response> {
  consumeError = (err: Error | Response): Error => CommonUtil.consumeError(err);
  consumeJSON = <T>(text: string): T => CommonUtil.consumeJSON(text);
  makeRequest<T>(params: unknown[], cfg: RequestDefinition): Promise<T> {
    return CommonUtil.fetchRequest<T, BodyInit, Response>(this, CommonUtil.buildRequest(this, params, cfg), fetch);
  }
}