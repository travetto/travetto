import * as http from 'http';
import * as https from 'https';
import * as qs from 'querystring';
import * as url from 'url';

import { AppError, HTTP_ERROR_CONVERSION } from '@travetto/base';

interface HttpClient {
  request(args: http.ClientRequestArgs, cb: (response: http.IncomingMessage) => void): {
    on(type: 'error', cb: (err: any) => void): void;
    end(): void;
    write(text: string): void;
  };
}

type ExecArgs = http.RequestOptions & { url: string };
type _ExecArgs = ExecArgs & { payload?: any };

type ResponseHandler<T> = (msg: http.IncomingMessage) => Promise<T>;

export class HttpRequest {

  private static buildError(config: {
    message: string,
    status?: number,
    payload: { [key: string]: any }
  }) {
    let finalStatus = HTTP_ERROR_CONVERSION.to.get(config.status!) || 'general';
    try {
      const parsedMessage = JSON.parse(config.message);
      const { status, statusCode, message, ...rest } = parsedMessage;
      finalStatus = HTTP_ERROR_CONVERSION.to.get(status) ||
        HTTP_ERROR_CONVERSION.to.get(statusCode) ||
        finalStatus;
      config.message = message || config.message;
      Object.assign(config.payload, rest); // Merge it in
    } catch { }
    return new AppError(config.message, finalStatus, config.payload);
  }

  private static async _exec(opts: _ExecArgs, retry?: number): Promise<string>;
  private static async _exec<T>(opts: _ExecArgs & { binary: true }, retry?: number): Promise<Buffer>;
  private static async _exec<T>(opts: _ExecArgs & { responseHandler: ResponseHandler<T> }, retry?: number): Promise<T>;
  private static async _exec<T = any>(inOpts: _ExecArgs & { responseHandler?: ResponseHandler<T> }, retry = 0): Promise<string | Buffer | T> {
    const { client, payload, responseHandler, binary, opts } = this.requestOpts(inOpts);

    try {
      return await this.rawRequest(client, opts, payload, responseHandler, binary);
    } catch (e) {
      if (typeof e === 'string') {
        try {
          e = JSON.parse(e);
        } catch { }
      }
      // Handle redirect
      if (e.status && e.status >= 300 && e.status < 400 && e.headers.location) {
        if (retry < 5) {
          return this._exec({ ...inOpts, url: e.headers.location }, retry + 1);
        } else {
          throw new Error('Maximum number of redirects attempted');
        }
      }
      throw e;
    }
  }

  static requestOpts<T>(inOpts: _ExecArgs & { binary?: boolean, responseHandler?: ResponseHandler<T> }) {
    const { url: requestUrl, payload: inPayload, responseHandler, ...rest } = inOpts;
    const { hostname: host, port, pathname: path, username, password, searchParams, protocol } = new url.URL(requestUrl);

    const opts = {
      host,
      port,
      auth: (username && password) ? `${username}:${password}` : undefined,
      path,
      method: 'GET',
      headers: {},
      ...rest
    };

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
        opts.path = `${opts.path || ''}?${searchParams.toString()}`;
      }
    } else {
      const q = Array.from(searchParams.entries())
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

      opts.path = `${opts.path}?${q}`;
    }

    return { client, payload, responseHandler, opts, binary: inOpts.binary };
  }

  static configJSON(opts: _ExecArgs) {
    const out: _ExecArgs = { ...opts };

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

  static async rawRequest<T>(client: HttpClient, requestOpts: http.ClientRequestArgs, payload?: any, responseHandler?: ResponseHandler<T>, binary?: boolean) {
    return new Promise<string | Buffer | T>((resolve, reject) => {
      const req = client.request(requestOpts, (msg: http.IncomingMessage) => {
        const body: Buffer[] = [];

        if (!responseHandler) {
          if (!binary) {
            msg.setEncoding('utf8');
          }
        }

        msg.on('data', (chunk: Buffer) => {
          if ((msg.statusCode || 200) > 299 || !responseHandler) {
            body.push(Buffer.from(chunk));
          }
        });

        msg.on('error', err => {
          reject(this.buildError({ message: err.message, status: msg.statusCode, payload: { headers: msg.headers } }));
        });

        msg.on('end', () => {
          const message = Buffer.concat(body);
          if ((msg.statusCode || 200) > 299) {
            reject(this.buildError({ message: message.toString(), status: msg.statusCode, payload: { headers: msg.headers } }));
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

  static async exec(opts: ExecArgs, payload?: any): Promise<string>;
  static async exec(opts: ExecArgs & { binary: true }, payload?: any): Promise<Buffer>;
  static async exec<T>(opts: ExecArgs & { responseHandler: ResponseHandler<T> }, payload?: any): Promise<T>;
  static async exec<T>(opts: ExecArgs & { binary?: boolean, responseHandler?: ResponseHandler<T> }, payload?: any): Promise<string | Buffer | T> {
    return await this._exec({ ...opts, payload });
  }

  static async execJSON<T, U = any>(opts: ExecArgs, payload?: U): Promise<T> {
    const res = await this._exec(this.configJSON({ ...opts, payload }));
    return JSON.parse(res) as T;
  }

  static async pipe(readable: NodeJS.ReadableStream, writable: NodeJS.WritableStream) {
    return new Promise((resolve, reject) => {
      writable
        .on('error', reject);

      readable.pipe(writable)
        .on('finish', resolve)
        .on('end', resolve)
        .on('close', resolve)
        .on('error', reject);
    });
  }
}