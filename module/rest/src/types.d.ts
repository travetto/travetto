import * as exp from 'express-serve-static-core';

declare global {
  namespace Travetto {
    interface Request {
      method?: string;
      path: string;
      query: { [key: string]: any };
      params: { [key: string]: any };
      session: any;
      headers: { [key: string]: string | string[] };
      cookies: { [key: string]: any };
      body: any;
      pipe(stream: NodeJS.WritableStream): any;
      header(key: string): string | undefined;
      on(ev: 'end' | 'close' | 'error', cb: Function): any;
    }

    interface Response {
      statusCode: number;
      headersSent: boolean;
      getHeader(key: string): string;
      setHeader(key: string, value: string): void;
      removeHeader(key: string): void;

      header(key: string, value: string | string[]): any;
      on(ev: 'close' | 'finish', cb: Function): any;

      send(value: any): any;
      write(value: any): any;
      end(): any;

      cookie(key: string, value: any, options: Partial<{
        domain: string,
        expires: Date,
        maxAge: number,
        path: string,
        secure: boolean,
        signed: boolean,
        httpOnly: boolean
      }>): void;
    }
  }
}