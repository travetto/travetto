import * as http from 'http';
import * as https from 'https';
import * as qs from 'querystring';
import * as url from 'url';

export async function request(opts: http.RequestOptions & { url: string }, data?: any): Promise<string>;
export async function request(opts: http.RequestOptions & { url: string, pipeTo: any }, data?: any): Promise<http.IncomingMessage>;
export async function request(opts: http.RequestOptions & { url: string, pipeTo?: any }, data?: any): Promise<string | http.IncomingMessage> {
  const { url: requestUrl } = opts;
  delete opts.url;

  const { query, hash, href, pathname, search, slashes, ...parsed } = url.parse(requestUrl);

  opts = { method: 'GET', headers: {}, ...opts, ...parsed };

  const client = ((opts.protocol === 'https:' ? https : http) as any);
  delete opts.protocol;

  const hasBody = (opts.method === 'POST' || opts.method === 'PUT');
  let bodyStr: string;

  if (data) {
    if (hasBody) {
      bodyStr = data.toString();
      (opts.headers as any)['Content-Length'] = Buffer.byteLength(bodyStr);
    } else {
      (opts as any)['query'] = { ...(opts as any)['query'], ...qs.parse(data) };
    }
  }

  if ((opts as any)['query']) {
    opts.path = `${opts.path || ''}?${qs.stringify((opts as any)['query'])}`;
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