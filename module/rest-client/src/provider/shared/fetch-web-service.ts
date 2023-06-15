/// <reference lib="dom" />

import { BaseRemoteService, RequestDefinition, RequestOptions } from './types';
import { CommonUtil } from './util';

type Chunk = { name: string, blob: Blob };

export abstract class BaseWebFetchService extends BaseRemoteService<BodyInit, Response> {

  consumeError = (err: Error | Response): Error => CommonUtil.consumeError(err);
  consumeJSON = <T>(text: string): T => CommonUtil.consumeJSON(text);

  buildRequestShape(params: unknown[], cfg: RequestDefinition): RequestOptions<BodyInit> {
    return CommonUtil.buildRequest<BodyInit, Blob, Chunk, Response>(this, params, cfg, {
      addItem: (name, blob) => ({ name, blob }),
      addJson: (name, json) => ({ name, blob: new Blob([JSON.stringify(json)], { type: 'application/json' }) }),
      finalize(items) {
        if (items.length === 1) {
          return items[0].blob;
        } else {
          const form = new FormData();
          for (const { name, blob } of items) {
            form.append(name, blob, 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined);
          }
          return form;
        }
      }
    });
  }

  makeRequest<T>(params: unknown[], cfg: RequestDefinition): Promise<T> {
    return CommonUtil.fetchRequest<T, BodyInit, Response>(this, this.buildRequestShape(params, cfg), fetch);
  }
}