import { BodyInit, Response } from 'node-fetch';

export type UploadContent = { type?: string, buffer: Buffer, filename?: string, size?: number };

export type FetchRequestShape = {
  headers: Record<string, string>;
  url: URL;
  body?: BodyInit;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
};


export type PreRequestHandler = (req: FetchRequestShape) => FetchRequestShape | undefined | void | Promise<FetchRequestShape | undefined | void>;
export type PostResponseHandler = (res: Response) => Response | undefined | void | Promise<Response | undefined | void>;

export type IFetchService = {
  basePath: string;
  routePath: string;
  preRequestHandlers: PreRequestHandler[];
  postResponseHandlers: PostResponseHandler[];
  headers: Record<string, string>;
};

export type IFetchServiceConfig = Partial<Omit<IFetchService, 'routePath'>>;

export type ParamConfig = {
  location: 'header' | 'body' | 'path' | 'query';
  array?: boolean;
  binary?: boolean;
  name: string;
  key?: string;
  complex?: boolean;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export class placeholder { }