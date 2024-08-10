import { IRemoteService, ParamConfig, RequestDefinition, RequestOptions } from './types';

type BodyPart = { param: unknown, config: ParamConfig };

export function RestCast<T>(input: unknown): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return input as T;
}

export class CommonUtil {
  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static flattenPaths(data: Record<string, unknown>, prefix: string = '', defaultMissing = false): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const pre = `${prefix}${key}`;
      if (this.isPlainObject(value)) {
        Object.assign(out, this.flattenPaths(value, `${pre}.`, defaultMissing)
        );
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const v = value[i];
          if (this.isPlainObject(v)) {
            Object.assign(out, this.flattenPaths(v, `${pre}[${i}].`, defaultMissing));
          } else {
            if ((v !== undefined && v !== null) || defaultMissing) {
              out[`${pre}[${i}]`] = v ?? '';
            }
          }
        }
      } else {
        if ((value !== undefined && value !== null) || defaultMissing) {
          out[pre] = value ?? '';
        }
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

  static requestBody<T>(body: BodyPart[]): { body: T, headers: Record<string, string> } | undefined {
    if (!body.length) {
      return undefined;
    }

    const parts: { name: string, blob: Blob }[] = [];

    for (const { param, config } of body) {
      const pName = config.name;
      if (config.binary) {
        if (config.array) {
          parts.push(...(RestCast<Blob[]>(param)).map((uc, i) => ({ name: `${pName}[${i}]`, blob: uc })));
        } else {
          parts.push({ name: pName, blob: RestCast(param) });
        }
      } else {
        parts.push({ name: pName, blob: new Blob([JSON.stringify(param)], { type: 'application/json' }) });
      }
    }
    if (body.length === 1) {
      const blob: Blob = parts[0].blob;
      return {
        body: RestCast(blob),
        headers: 'name' in blob ? {
          'Content-Disposition': `inline; filename="${blob.name}"`
        } : {}
      };
    } else {
      const form = new FormData();
      for (const { name, blob } of parts) {
        form.append(name, blob, 'name' in blob && typeof blob.name === 'string' ? blob.name : undefined);
      }
      return { body: RestCast(form), headers: {} };
    }
  }

  static buildRequest<T, R = unknown>(svc: IRemoteService<T, R>, params: unknown[], def: RequestDefinition): RequestOptions<T> {
    const { endpointPath, paramConfigs, method } = def;

    let resolvedPath = `${svc.baseUrl}/${svc.routePath}/${endpointPath || ''}`.replace(/[\/]+/g, '/').replace(/[\/]$/, '');
    const query: Record<string, string> = {};
    const headers: Record<string, string> = { ...svc.headers };
    const body: BodyPart[] = [];
    for (let i = 0; i < paramConfigs.length; i++) {
      const { location: loc, prefix, complex, name } = paramConfigs[i];
      if ((loc === 'header' || loc === 'query') && params[i] !== undefined) {
        const sub = this.flattenPaths(
          (prefix || !complex) ?
            { [prefix ?? name]: params[i] } :
            RestCast(params[i]),
          '',
          loc === 'header'
        );
        if (loc === 'header') {
          Object.assign(headers, sub);
        } else {
          Object.assign(query, sub);
        }
      } else if (loc === 'path') {
        resolvedPath = resolvedPath.replace(`:${paramConfigs[i].name}`, `${params[i]}`);
      } else if (loc === 'body') {
        if (params[i] !== undefined) {
          body.push({ param: params[i], config: paramConfigs[i] });
        }
      }
    }

    const url = new URL(resolvedPath);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, `${v}`);
    }

    const { headers: requestHeaders, body: requestBody } = this.requestBody<T>(body) || {};

    return RestCast({
      headers: { ...headers, ...requestHeaders },
      url,
      method,
      body: requestBody,
      withCredentials: svc.withCredentials,
      timeout: svc.timeout
    });
  }
}