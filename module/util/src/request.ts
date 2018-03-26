import * as http from 'http';
import * as https from 'https';

export function parseQuery(query: string) {
  if (typeof query !== 'string') {
    return query;
  }
  return query.split('&')
    .map(x => {
      const [l, r] = x.split('=');
      if (l) {
        const out = [decodeURIComponent(l)];
        if (r) {
          out.push(decodeURIComponent(r));
        }
        return out as [string, string];
      } else {
        return undefined as any as [string, string];
      }
    })
    .filter(x => !!x)
    .reduce((acc, pair) => {
      acc[pair[0]] = pair[1];
      return acc;
    }, {} as { [key: string]: string });
}

export function formatQuery(query: any) {
  if (typeof query === 'string') {
    return query;
  }
  return Object.keys(query)
    .map(x => {
      let res = encodeURIComponent(x);
      const val = (query as any)[x];
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

  const res: { [key: string]: any } = {
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

export async function request(opts: http.RequestOptions & { url: string }, data?: any): Promise<string>;
export async function request(opts: http.RequestOptions & { url: string, pipeTo: any }, data?: any): Promise<http.IncomingMessage>;
export async function request(opts: http.RequestOptions & { url: string, pipeTo?: any }, data?: any): Promise<string | http.IncomingMessage> {
  const { url } = opts;
  delete opts.url;

  opts = { method: 'GET', headers: {}, ...opts, ...parseUrl(url) };

  const client = ((opts.protocol === 'https:' ? https : http) as any);
  delete opts.protocol;

  const hasBody = (opts.method === 'POST' || opts.method === 'PUT');
  let bodyStr: string;

  if (data) {
    if (hasBody) {
      bodyStr = data.toString();
      (opts.headers as any)['Content-Length'] = Buffer.byteLength(bodyStr);
    } else {
      (opts as any)['query'] = { ...(opts as any)['query'], ...parseQuery(data) };
    }
  }

  if ((opts as any)['query']) {
    opts.path = `${opts.path || ''}?${formatQuery((opts as any)['query'])}`;
  }

  return await new Promise<string | http.IncomingMessage>((resolve, reject) => {
    const req = client.request(opts, (msg: http.IncomingMessage) => {
      let body = '';
      if (!opts.pipeTo) {
        msg.setEncoding('utf8');
      }

      msg.on('data', (chunk: string) => {
        if ((msg.statusCode || 200) > 299 || !opts.pipeTo) {
          body += chunk;
        }
      });

      msg.on('end', () => {
        if ((msg.statusCode || 200) > 299) {
          reject({ message: body, status: msg.statusCode });
        } else {
          resolve(opts.pipeTo ? msg : body);
        }
      });
      if (opts.pipeTo) {
        msg.pipe(opts.pipeTo);
        if (opts.pipeTo.on) {
          opts.pipeTo.on('error', reject);
          if (opts.pipeTo.close) {
            opts.pipeTo.on('finish', () => opts.pipeTo.close())
          }
        }
      }
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
  for (const k of ['Content-Type', 'Accept']) {
    if (!opts.headers[k]) {
      opts.headers[k] = 'application/json';
    }
  }
  try {
    const res = await request(opts, data && JSON.stringify(data));
    return JSON.parse(res) as T;
  } catch (e) {
    if (typeof e === 'string') {
      e = JSON.parse(e);
    }
    throw e;
  }
}