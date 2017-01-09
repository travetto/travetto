import * as http from 'http';
import * as https from 'https';

export function parseQuery(query: string) {
  if (typeof query !== 'string') {
    return query;
  }
  return query.split('&')
    .map(x => {
      let [l, r] = x.split('=');
      if (l) {
        let out = [decodeURIComponent(l)];
        if (r) {
          out.push(decodeURIComponent(r));
        }
        return out;
      }
    })
    .filter(x => !!x)
    .reduce((acc: { [key: string]: string }, pair: [string, string]) => {
      acc[pair[0]] = pair[1];
      return acc;
    }, {});
}

export function formatQuery(query: any) {
  if (typeof query === 'string') {
    return query;
  }
  return Object.keys(query)
    .map(x => {
      let res = encodeURIComponent(x);
      let val = (query as any)[x];
      if (val !== undefined && val !== null) {
        res = `${res}=${val}`;
      }
      return res;
    })
    .join('&');
}

export function parseUrl(url: string) {
  let protocol = '',
    hostname = '',
    hostRaw = '',
    query = {},
    path: string[] = [],
    auth = '',
    port = '';

  [protocol, hostRaw] = url.split('//', 2);
  [hostRaw, query] = hostRaw.split('?');
  [hostRaw, ...path] = hostRaw.split('/');

  if (hostRaw.indexOf('@') > 0) {
    [auth, hostRaw] = hostRaw.split('@', 2);
  }

  [hostname, port] = hostRaw.split(':', 2);
  port = port || (protocol === 'http:' ? '80' : '443');

  let res: { [key: string]: any } = {
    hostname,
    protocol,
    port,
  };

  if (query) {
    if (typeof query === 'string') {
      res['query'] = parseQuery(query);
    }
  }

  if (path.length) {
    res['path'] = `/${path.join('/')}`;
  }

  if (auth) {
    res['auth'] = auth;
  }
  return res;
}

export async function request(opts: http.RequestOptions & { url: string }, data?: any): Promise<string> {
  let {url} = opts;
  delete opts.url;

  opts = Object.assign({ method: 'GET', headers: {} }, opts, parseUrl(url));

  let client = ((opts.protocol === 'https' ? http : https) as any);
  delete opts.protocol;

  let hasBody = (opts.method === 'POST' || opts.method === 'PUT');
  let bodyStr: string;

  if (data) {
    if (hasBody) {
      bodyStr = data.toString();
      (opts.headers as any)['Content-Length'] = Buffer.byteLength(bodyStr);
    } else {
      (opts as any)['query'] = Object.assign({}, (opts as any)['query'], parseQuery(data));
    }
  }

  if ((opts as any)['query']) {
    opts.path = `${opts.path || ''}?${formatQuery((opts as any)['query'])}`;
  }

  return await new Promise<string>((resolve, reject) => {
    let req = client.request(opts, (msg: http.IncomingMessage) => {
      let body = '';
      msg.setEncoding('utf8');
      msg.on('data', (chunk: string) => body += chunk);
      msg.on('end', () => {
        if (msg.statusCode > 299) {
          reject({ message: body, status: msg.statusCode });
        } else {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (hasBody && bodyStr) {
      req.write(bodyStr);
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

