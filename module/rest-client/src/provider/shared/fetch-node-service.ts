import fetch, { BodyInit, Response } from 'node-fetch';
import { BaseRemoteService, RequestDefinition, RequestOptions } from './types';
import { CommonUtil } from './util';

export type UploadContent = { type?: string, buffer: Buffer, filename?: string, size?: number };

type MultiPart = UploadContent & { name: string };

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

  getMultipartRequest(chunks: MultiPart[]): { body: Buffer, headers: Record<string, string> } {
    const boundary = `-------------------------multipart-${Date.now()}-${Math.random()}-${process.pid}`.replace(/[.]/, '-');
    const nl = '\r\n';

    const header = (flag: boolean, key: string, ...values: (string | number | undefined)[]): string | Buffer =>
      flag ? `${key}: ${values.map(v => `${v}`).join(';')}${nl}` : Buffer.alloc(0);

    const lines = [
      ...chunks.flatMap(chunk => [
        '--', boundary, nl,
        header(true, 'Content-Disposition', 'form-data', `name="${chunk.name}"`, `filename="${chunk.filename ?? chunk.name}"`),
        header(!!chunk.size, 'Content-Length', chunk.size),
        header(!!chunk.type, 'Content-Type', chunk.type),
        nl,
        chunk.buffer, nl
      ]),
      '--', boundary, '--', nl
    ];

    const body = Buffer.concat(lines.map(l => Buffer.from(l)));

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': `${body.length}`
    };

    return { body, headers };
  }

  buildRequestShape(params: unknown[], cfg: RequestDefinition): RequestOptions<BodyInit> {
    return CommonUtil.buildRequest<BodyInit, UploadContent, MultiPart, Response>(this, params, cfg, {
      addItem: (name, item) => ({ ...item, name, }),
      addJson: (name, obj) => ({
        buffer: Buffer.from(JSON.stringify(obj)),
        type: 'application/json',
        name
      }),
      finalize: (items, req) => {
        if (items.length === 1) {
          req.headers['Content-Type'] = items[0].type!;
          return items[0].buffer;
        } else {
          const { body, headers } = this.getMultipartRequest(items);
          Object.assign(req.headers, headers);
          return body;
        }
      }
    });
  }

  makeRequest<T>(params: unknown[], cfg: RequestDefinition): Promise<T> {
    return CommonUtil.fetchRequest<T, BodyInit, Response>(this, this.buildRequestShape(params, cfg), fetch);
  }
}