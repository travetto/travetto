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

export class Request {
  static args(opts: http.RequestOptions & { url: string }, data?: any) {
    const { url: optsUrl, ...optsWithoutUrl } = opts;

    const { hostname: host, port, pathname: path, username, password, searchParams, protocol } = new url.URL(optsUrl);
    const auth = (username && password) ? `${username}:${password}` : undefined;
    const client = (protocol === 'https:' ? https : http) as HttpClient;

    console.log(host, port, path, username, password, searchParams.toString(), protocol);

    const finalOpts = {
      host, port,
      auth, path,
      method: 'GET',
      headers: {},
      payload: undefined as any,
      pipeTo: undefined as any,
      ...optsWithoutUrl
    };

    const hasBody = (finalOpts.method === 'POST' || finalOpts.method === 'PUT');
    let payload: string | undefined = undefined;

    if (data) {
      if (hasBody) {
        payload = data.toString();
        finalOpts.headers['Content-Length'] = Buffer.byteLength(payload as string);
      } else {
        const passedData = typeof data === 'string' ? qs.parse(data) : data;
        for (const key of Object.keys(passedData)) {
          searchParams.set(key, passedData[key]);
        }
      }
    }

    if (Array.from(searchParams.values()).length) {
      finalOpts.path = `${finalOpts.path || ''}?${searchParams.toString()}`;
    }

    return { opts: finalOpts, client, payload };
  }

  static jsonArgs(opts: http.RequestOptions & { url: string }, data?: any) {
    if (!opts.headers) {
      opts.headers = {};
    }
    for (const k of ['Content-Type', 'Accept']) {
      if (!opts.headers[k]) {
        opts.headers[k] = 'application/json';
      }
    }
    const payload = data && (opts.method === 'POST' || opts.method === 'PUT') ?
      JSON.stringify(data) : data;

    return this.args(opts, payload);
  }

  static async exec(client: HttpClient, opts: http.ClientRequestArgs, payload?: any): Promise<string>;
  static async exec(client: HttpClient, opts: http.ClientRequestArgs, payload: any, pipeTo: any): Promise<http.IncomingMessage>;
  static async exec(client: HttpClient, opts: http.ClientRequestArgs, payload?: any, pipeTo?: any): Promise<string | http.IncomingMessage> {
    return await new Promise<string | http.IncomingMessage>((resolve, reject) => {
      const req = client.request(opts, (msg: http.IncomingMessage) => {
        let body = '';
        if (!pipeTo) {
          msg.setEncoding('utf8');
        }

        msg.on('data', (chunk: string) => {
          if ((msg.statusCode || 200) > 299 || !pipeTo) {
            body += chunk;
          }
        });

        msg.on('end', () => {
          if ((msg.statusCode || 200) > 299) {
            reject({ message: body, status: msg.statusCode });
          } else {
            resolve(pipeTo ? msg : body);
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
      if ((opts.method === 'PUT' || opts.method === 'POST') && payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  }

  static async request(opts: http.RequestOptions & { url: string }, data?: any): Promise<string>;
  static async request(opts: http.RequestOptions & { url: string, pipeTo: any }, data?: any): Promise<http.IncomingMessage>;
  static async request(opts: http.RequestOptions & { url: string, pipeTo?: any }, data?: any): Promise<string | http.IncomingMessage> {
    const pipeTo = opts.pipeTo;
    delete opts.pipeTo;

    const { opts: finalOpts, client, payload } = this.args(opts, data);
    return this.exec(client, finalOpts, payload, pipeTo);
  }

  static async requestJSON<T, U>(opts: http.RequestOptions & { url: string }, data?: U): Promise<T> {
    const { opts: finalOpts, client, payload } = this.jsonArgs(opts, data);

    try {
      const res = await this.exec(client, finalOpts, payload);
      return JSON.parse(res) as T;
    } catch (e) {
      if (typeof e === 'string') {
        e = JSON.parse(e);
      }
      throw e;
    }
  }
}