import * as http from 'http';

export interface HttpClient {
  request(args: http.ClientRequestArgs, cb: (response: http.IncomingMessage) => void): {
    on(type: 'error', cb: (err: any) => void): void;
    end(): void;
    write(text: string): void;
  };
}

export type ExecArgs = { [k in keyof http.RequestOptions]?: NonNullable<http.RequestOptions[k]> } & { url: string };
export type RawExecArgs = ExecArgs & { payload?: any };

export type ResponseHandler<T> = (msg: http.IncomingMessage) => Promise<T>;

export type URLContext = {
  host?: string;
  port?: number | string;
  auth?: string;
  path?: string;
  protocol?: string;
  method?: string;
  headers: Record<string, undefined | number | string | string[]>;
};

export type RequestContext = {
  client: HttpClient;
  payload: any;
  responseHandler?: ResponseHandler<any>;
  opts: URLContext;
  binary?: boolean;
};
