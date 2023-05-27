import { BodyInit, Response } from 'node-fetch';
import { IRemoteService, RequestShape } from './common';

export type UploadContent = { type?: string, buffer: Buffer, filename?: string, size?: number };

export type FetchRequestShape = RequestShape<BodyInit, IFetchService>;
export type PreRequestHandler = (req: FetchRequestShape) => FetchRequestShape | undefined | void | Promise<FetchRequestShape | undefined | void>;
export type PostResponseHandler = (res: Response) => Response | undefined | void | Promise<Response | undefined | void>;

export interface IFetchService extends IRemoteService {
  preRequestHandlers: PreRequestHandler[];
  postResponseHandlers: PostResponseHandler[];
}

export type IFetchServiceConfig = Partial<Omit<IFetchService, 'routePath'>>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export class placeholder { }