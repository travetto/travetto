import * as http from 'http';

/**
 * Simple HTTP Client
 */
export interface HttpClient {
  request(args: http.ClientRequestArgs, cb: (response: http.IncomingMessage) => void): {
    on(type: 'error', cb: (err: any) => void): void;
    end(): void;
    write(text: string): void;
  };
}

/**
 * HTTP Exec arguments
 */
export type HttpExecArgs = { [k in keyof http.RequestOptions]?: NonNullable<http.RequestOptions[k]> } & {
  url: string;
  insecure?: boolean;
};
export type HttpRawExecArgs = HttpExecArgs & { payload?: any };

/**
 * Http Response Handler
 */
export type HttpResponseHandler<T> = (msg: http.IncomingMessage) => Promise<T>;

/**
 * URL context
 */
export type URLContext = {
  host?: string;
  port?: number | string;
  auth?: string;
  path?: string;
  protocol?: string;
  method?: string;
  headers: Record<string, undefined | number | string | string[]>;
};

/**
 * HTTP Request Context
 */
export type HttpRequestContext = {
  client: HttpClient;
  payload: any;
  responseHandler?: HttpResponseHandler<any>;
  opts: URLContext;
  binary?: boolean;
};
