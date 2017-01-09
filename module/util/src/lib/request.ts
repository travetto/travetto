import * as http from 'http';
import * as https from 'https';

export function parseUrl(url: string) {
  let [protocol, remainder] = url.split('//', 2);
  let [hostRaw, path] = remainder.split('/', 2);
  let auth = '';
  if (hostRaw.indexOf('@') > 0) {
    [auth, hostRaw] = hostRaw.split('@', 2);
  }
  let [host, port] = hostRaw.split(':', 2);
  let res: any = {
    hostname: host,
    protocol,
    port: port || (protocol === 'http:' ? 80 : 443),
  };
  if (path !== undefined) {
    res.path = `/${path}`;
  }
  if (auth) {
    res.auth = auth;
  }
  return res;
}

export async function request(opts: http.RequestOptions & { url: string }, data?: string): Promise<string> {
  let {url} = opts;
  delete opts.url;

  opts = Object.assign({ method: 'GET', headers: {} }, opts, parseUrl(url));

  let hasBody = (opts.method === 'post' || opts.method === 'put');

  if (hasBody && data) {
    (opts.headers as any)['Content-Length'] = Buffer.byteLength(data) + 1;
  }

  return await new Promise<string>((resolve, reject) => {
    let req = ((opts.protocol === 'https' ? http : https) as any).request(opts, (msg: http.IncomingMessage) => {
      let body = '';
      msg.setEncoding('utf8');
      msg.on('data', chunk => body += chunk);
      msg.on('end', chunk => {
        if (msg.statusCode > 299) {
          reject({ message: body, status: msg.statusCode });
        } else {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (hasBody && data) {
      req.write(data);
    }
    req.end();
  });
}

export async function requestJSON<T, U>(opts: http.RequestOptions & { url: string }, data?: U): Promise<T> {
  if (!opts.headers) {
    opts.headers = {};
  }
  for (let k of ['Content-Type', 'Accept']) {
    if (!opts.headers[k]) {
      opts.headers[k] = 'application/json';
    }
  }
  try {
    let res = await request(opts, data && JSON.stringify(data));
    return JSON.parse(res) as T;
  } catch (e) {
    if (typeof e === 'string') {
      e = JSON.parse(e);
    }
    throw e;
  }
}

