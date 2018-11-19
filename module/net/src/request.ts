import * as http from 'http';
import * as https from 'https';
import * as qs from 'querystring';
import * as url from 'url';

interface HttpClient {
  request(args: http.ClientRequestArgs, cb: (response: http.IncomingMessage) => void): {
    on(type: 'error', cb: (err: any) => void): void;
    end(): void;
    write(text: string): void;
  };
}

type ExecArgs = http.RequestOptions & { url: string };
type _ExecArgs = ExecArgs & { payload?: any };

export class HttpRequest {

  private static async _exec(opts: _ExecArgs, retry?: number): Promise<string>;
  private static async _exec(opts: _ExecArgs & { pipeTo: NodeJS.WritableStream }, retry?: number): Promise<http.IncomingMessage>;
  private static async _exec(inOpts: _ExecArgs & { pipeTo?: NodeJS.WritableStream }, retry = 0): Promise<string | http.IncomingMessage> {
    const { client, payload, pipeTo, opts } = this.requestOpts(inOpts);

    try {
      return await this.rawRequest(client, opts, payload, pipeTo);
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

  static requestOpts(inOpts: _ExecArgs & { pipeTo?: NodeJS.WritableStream }) {
    const { url: requestUrl, payload: inPayload, pipeTo, ...rest } = inOpts;
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
    }
    return { client, payload, pipeTo, opts };
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

  static async rawRequest(client: HttpClient, requestOpts: http.ClientRequestArgs, payload?: any, pipeTo?: any) {
    return new Promise<string | http.IncomingMessage>((resolve, reject) => {
      const req = client.request(requestOpts, (msg: http.IncomingMessage) => {
        const body: Buffer[] = [];

        if (!pipeTo) {
          msg.setEncoding('utf8');
        }

        msg.on('data', (chunk: Buffer) => {
          if ((msg.statusCode || 200) > 299 || !pipeTo) {
            body.push(Buffer.from(chunk));
          }
        });

        msg.on('end', () => {
          const bodyText = Buffer.concat(body).toString();
          if ((msg.statusCode || 200) > 299) {
            reject({ message: bodyText, status: msg.statusCode, headers: msg.headers });
          } else {
            resolve(pipeTo ? msg : bodyText);
          }
        });

        if (pipeTo) {
          msg.pipe(pipeTo);
          if (pipeTo.on) {
            pipeTo.on('error', reject);
            if (pipeTo.close) {
              pipeTo.on('finish', () => pipeTo.close());
            }
          }
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
  static async exec(opts: ExecArgs & { pipeTo: NodeJS.WritableStream }, payload?: any): Promise<http.IncomingMessage>;
  static async exec(opts: ExecArgs & { pipeTo?: NodeJS.WritableStream }, payload?: any): Promise<string | http.IncomingMessage> {
    return await this._exec({ ...opts, payload });
  }

  static async execJSON<T, U = any>(opts: ExecArgs, payload?: U): Promise<T> {

    const res = await this._exec(this.configJSON({ ...opts, payload }));
    return JSON.parse(res) as T;
  }
}