import 'express-serve-static-core';
import { SetOption, GetOption } from 'cookies';
import { IncomingMessage, ServerResponse } from 'http';
import { TRV_RAW, TRV_ORIG } from './types';

declare global {
  namespace Travetto {
    interface Request {
      [TRV_ORIG]?: any;
      [TRV_RAW]: IncomingMessage;
      method?: string;
      path: string;
      url: string;
      baseUrl?: string;
      protocol: string;

      query: Record<string, any>;
      params: Record<string, any>;
      headers: Record<string, string | string[]>;
      cookies: {
        get(name: string, options?: GetOption): string | undefined;
      };
      body: any;
      pipe(stream: NodeJS.WritableStream): any;
      header(key: string): string | string[] | undefined;
      on(ev: 'end' | 'close' | 'error', cb: Function): any;
    }

    interface Response {
      [TRV_ORIG]?: any;
      [TRV_RAW]: ServerResponse;
      statusCode: number;
      status(code?: number): (number | undefined);
      headersSent: boolean;
      getHeader(key: string): string;
      setHeader(key: string, value: string | string[]): void;
      removeHeader(key: string): void;

      on(ev: 'close' | 'finish', cb: Function): any;

      redirect(path: string): any;
      redirect(code: number, path: string): any;
      redirect(code: number | string, path?: string): any;

      location(path: string): any;

      json(value: any): any;
      send(value: any): any;
      write(value: any): any;
      end(val?: any): any;
      cookies: {
        set(name: string, value?: any, options?: SetOption): void;
      };
    }
  }
}