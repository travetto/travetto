import * as http from 'http';
import * as https from 'https';
import * as qs from 'querystring';
import * as url from 'url';

import { AppError } from '@travetto/base';
import { ErrorUtil } from '@travetto/base/src/internal/error';
import { HttpRawExecArgs, HttpResponseHandler, HttpRequestContext, URLContext, HttpClient, HttpExecArgs } from './types';

/**
 * Simple http rest client
 */
export class HttpRequest {

  /**
   * Build the http error
   */
  private static buildError(config: {
    message: string;
    status?: number;
    payload: Record<string, any>;
  }) {
    let finalStatus = ErrorUtil.categoryFromCode(config.status);
    try {
      const parsedMessage = JSON.parse(config.message);
      const { status, statusCode, message, ...rest } = parsedMessage;
      finalStatus = ErrorUtil.categoryFromCode(status, statusCode, config.status);
      config.message = message || config.message;
      Object.assign(config.payload, rest); // Merge it in
    } catch { }
    return new AppError(config.message, finalStatus, config.payload);
  }


  /**
   * Make a raw request.  Actually trigger the http(s) request to send
   */
  private static async rawRequest<T>({ client, opts: requestOpts, payload, responseHandler, binary }: HttpRequestContext) {
    return new Promise<string | Buffer | T>((resolve, reject) => {
      const req = client.request(requestOpts, (msg: http.IncomingMessage) => {
        const body: Buffer[] = [];

        if (!responseHandler) {
          if (!binary) {
            msg.setEncoding('utf8');
          }
        }

        msg.on('data', (chunk: Buffer) => {
          if ((msg.statusCode ?? 200) > 299 || !responseHandler) {
            body.push(Buffer.from(chunk));
          }
        });

        msg.on('error', err => {
          reject(this.buildError({ message: err.message, status: msg.statusCode, payload: { headers: msg.headers } }));
        });

        msg.on('end', () => {
          const message = Buffer.concat(body);
          if ((msg.statusCode ?? 200) > 299) {
            if (msg.statusCode! > 399) {
              reject(this.buildError({ message: message.toString(), status: msg.statusCode, payload: { headers: msg.headers } }));
            } else {
              reject({ status: msg.statusCode, message: 'Redirect', headers: msg.headers });
            }
          } else {
            if (!responseHandler) {
              resolve(binary ? message : message.toString());
            }
          }
        });

        if (responseHandler) {
          responseHandler(msg).then(resolve, reject);
        }
      });

      req.on('error', reject);

      if ((requestOpts.method === 'PUT' || requestOpts.method === 'POST') && payload !== undefined) {
        req.write(payload);
      }

      req.end();
    });
  }

  /**
   * Raw execution of the http request
   */
  private static async rawExec(opts: HttpRawExecArgs, retry?: number): Promise<string>;
  private static async rawExec<T>(opts: HttpRawExecArgs & { binary: true }, retry?: number): Promise<Buffer>;
  private static async rawExec<T>(opts: HttpRawExecArgs & { responseHandler: HttpResponseHandler<T> }, retry?: number): Promise<T>;
  private static async rawExec<T = any>(inOpts: HttpRawExecArgs & { responseHandler?: HttpResponseHandler<T> }, retry = 0): Promise<string | Buffer | T> {
    try {
      return await this.rawRequest(this.buildRequestContext(inOpts));
    } catch (e) {
      if (typeof e === 'string') {
        try {
          e = JSON.parse(e);
        } catch { }
      }
      // Handle redirect
      if (e.status && e.status >= 300 && e.status < 400 && e.headers.location) {
        if (retry < 5) {
          return this.rawExec({ ...inOpts, url: e.headers.location }, retry + 1);
        } else {
          throw new Error('Maximum number of redirects attempted');
        }
      }
      throw e;
    }
  }

  /**
   * Produces the necessary data for the request to be executed
   */
  static buildRequestContext<T>(inOpts: HttpRawExecArgs & { binary?: boolean, responseHandler?: HttpResponseHandler<T> }): HttpRequestContext {
    const { url: requestUrl, payload: inPayload, responseHandler, ...rest } = inOpts;
    const { hostname: host, port, pathname: path, username, password, searchParams, protocol } = new url.URL(requestUrl) as Required<url.URL>;

    const opts: URLContext = {
      host,
      port,
      auth: (username && password) ? `${username}:${password}` : undefined,
      path,
      protocol,
      method: 'GET',
      ...rest,
      headers: rest.headers ?? {}
    } as const;

    let payload = inPayload;

    const hasBody = (opts.method === 'POST' || opts.method === 'PUT');
    const client = (protocol === 'https:' ? https : http) as HttpClient;

    if (payload) {
      if (hasBody) {
        payload = payload.toString();
        opts.headers['Content-Length'] = Buffer.byteLength(payload as string);
      } else {
        const passedData = typeof payload === 'string' ? qs.parse(payload) : payload;
        for (const key of Object.keys(passedData)) {
          searchParams.set(key, passedData[key]);
        }
      }
      if (Array.from(searchParams.values()).length) {
        opts.path = `${opts.path ?? ''}?${searchParams.toString()}`;
      }
    } else {
      const q = Array.from(searchParams.entries())
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

      opts.path = `${opts.path}?${q}`;
    }

    return { client, payload, responseHandler, opts, binary: inOpts.binary };
  }

  /**
   * Add a JSON payload to the request
   */
  static withJSONPayload(opts: HttpRawExecArgs) {
    const out: HttpRawExecArgs = { ...opts };

    if (!out.headers) {
      out.headers = {};
    }
    for (const k of ['Content-Type', 'Accept']) {
      if (!out.headers[k]) {
        out.headers[k] = 'application/json';
      }
    }

    out.payload = opts.payload && (out.method === 'POST' || out.method === 'PUT') ?
      JSON.stringify(opts.payload) : opts.payload;

    return out;
  }

  /**
   * Execute a simple http request
   */
  static async exec(opts: HttpExecArgs, payload?: any): Promise<string>;
  static async exec(opts: HttpExecArgs & { binary: true }, payload?: any): Promise<Buffer>;
  static async exec<T>(opts: HttpExecArgs & { responseHandler: HttpResponseHandler<T> }, payload?: any): Promise<T>;
  static async exec<T>(opts: HttpExecArgs & { binary?: boolean, responseHandler?: HttpResponseHandler<T> }, payload?: any): Promise<string | Buffer | T> {
    return await this.rawExec({ ...opts, payload });
  }

  /**
   * Execute a request, assuming the payload and response are both JSON
   */
  static async execJSON<T, U = any>(opts: HttpExecArgs, payload?: U): Promise<T> {
    const res = await this.rawExec(this.withJSONPayload({ ...opts, payload }));
    return JSON.parse(res) as T;
  }
}