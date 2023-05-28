export type ParamConfig = {
  location: 'header' | 'body' | 'path' | 'query';
  array?: boolean;
  binary?: boolean;
  name: string;
  key?: string;
  complex?: boolean;
};

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'head' | 'options' | 'patch';

export type RequestOptions = {
  method: HttpMethod;
  endpointPath: string;
  paramConfigs: ParamConfig[] | (readonly ParamConfig[]);
};

export type MultipartHandler<T, B, P> = {
  addJson: (name: string, obj: unknown) => P;
  addItem: (name: string, item: B) => P;
  finalize: (items: P[], request: RawRequestOptions<T>) => T;
};

export type RawRequestOptions<T = unknown> = {
  headers: Record<string, string>;
  url: URL;
  body?: T;
  method: HttpMethod;
};

export type IRemoteService = {
  baseUrl: string;
  routePath: string;
  headers: Record<string, string>;
};

export class CommonUtil {
  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static flattenPaths(data: Record<string, unknown> | string | boolean | number | Date, prefix: string = ''): Record<string, unknown> {
    if (!this.isPlainObject(data) && !Array.isArray(data)) {
      if (data !== undefined && data !== '' && data !== null) {
        return { [prefix]: data };
      } else {
        return {};
      }
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = prefix ? `${prefix}.${key}` : key;
      if (this.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, pre)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (this.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}]`));
          } else if (v !== undefined && v !== '' && data !== null) {
            out[`${pre}[${i}]`] = v;
          }
        }
      } else if (value !== undefined && value !== '' && value !== null) {
        out[pre] = value;
      }
    }
    return out;
  }

  static consumeJSON<T>(text: string | unknown): T {
    if (typeof text !== 'string') {
      return this.consumeJSON(JSON.stringify(text));
    }
    return JSON.parse(text, (key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z/.test(value)) {
        return new Date(value);
      } else {
        return value;
      }
    });
  }

  static buildRequest<S extends IRemoteService, T, B, P>(
    svc: S, params: unknown[], { endpointPath, paramConfigs, method }: RequestOptions, multipart: MultipartHandler<T, B, P>
  ): RawRequestOptions<T> {
    let resolvedPath = `${svc.baseUrl}/${svc.routePath}/${endpointPath || ''}`.replace(/[\/]+/g, '/').replace(/[\/]$/, '');
    const query: Record<string, string> = {};
    const headers: Record<string, string> = { ...svc.headers };
    const bodyIdxs: number[] = [];
    for (let i = 0; i < paramConfigs.length; i++) {
      const loc = paramConfigs[i].location;
      if ((loc === 'header' || loc === 'query') && params[i] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const sub = this.flattenPaths(params[i] as string, paramConfigs[i].complex ? paramConfigs[i].key : paramConfigs[i].name);
        if (loc === 'header') {
          Object.assign(headers, sub);
        } else {
          Object.assign(query, sub);
        }
      } else if (loc === 'path') {
        resolvedPath = resolvedPath.replace(`:${paramConfigs[i].name}`, `${params[i]}`);
      } else if (loc === 'body') {
        if (params[i] !== undefined) {
          bodyIdxs.push(i);
        }
      }
    }

    const url = new URL(resolvedPath);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, `${v}`);
    }

    let body: T | undefined;

    const req: RawRequestOptions<T> = { headers, url, body, method };

    if (bodyIdxs.length) {
      const parts: P[] = [];

      for (const bodyIdx of bodyIdxs) {
        const bodyParam = paramConfigs[bodyIdx];
        const pName = bodyParam.name;
        if (bodyParam.binary) {
          if (bodyParam.array) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            parts.push(...(params[bodyIdx] as B[]).map((uc, i) =>
              multipart.addItem(`${pName}[${i}]`, uc)
            ));
          } else {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            parts.push(multipart.addItem(pName, params[bodyIdx] as B));
          }
        } else {
          parts.push(multipart.addJson(pName, params[bodyIdx]));
        }
      }
      req.body = multipart.finalize(parts, req);
    }
    return req;
  }
}