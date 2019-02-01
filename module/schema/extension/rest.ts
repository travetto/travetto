import { ControllerRegistry, RestError, ParamConfig, Filter, EndpointDecorator, Response, Request } from '@travetto/rest';
import { Util } from '@travetto/base';
import { Class } from '@travetto/registry';

import { SchemaRegistry, BindUtil, SchemaValidator, ValidationErrors } from '..';

// tslint:disable:no-invalid-this
(ValidationErrors as Class).prototype.render = function (res: Response) {
  res.status(403);
  res.json(this.toJSON({ status: 403 }));
};
// tslint:enable:no-invalid-this

function getBound<T>(cls: Class<T>, obj: any, view?: string) {
  try {
    return BindUtil.bindSchema(cls, obj, view);
  } catch (e) {
    throw new RestError(`Supplied data is incompatible with ${cls.__id}: ${e.message}`);
  }
}

export async function getSchemaBody<T>(req: Request, cls: Class<T>, view?: string) {
  if (Util.isPlainObject(req.body)) {
    const o = getBound(cls, req.body, view);
    if (SchemaRegistry.has(cls)) {
      return await SchemaValidator.validate(o, view);
    } else {
      return o;
    }
  } else {
    throw new RestError(`Body is missing or wrong type: ${req.body}`, 503);
  }
}

function schemaToParams(cls: Class, view?: string, prefix: string = '') {
  const viewConf = SchemaRegistry.has(cls) && SchemaRegistry.getViewSchema(cls, view);
  const schemaConf = viewConf && viewConf.schema;
  if (!schemaConf) {
    throw new Error(`Unknown class, not registered as a schema: ${cls.__id}`);
  }
  const params = Object.keys(schemaConf).reduce((acc, x) => {
    const field = schemaConf[x];
    if (SchemaRegistry.has(field.type) || SchemaRegistry.hasPending(field.type)) {
      acc = { ...acc, ...schemaToParams(field.type, undefined, prefix ? `${prefix}.${field.name}` : `${field.name}.`) };
    } else {
      acc[x] = {
        name: `${prefix}${field.name}`,
        description: field.description,
        type: field.type,
        required: field.required && field.required.active,
        location: 'query'
      };
    }
    return acc;
  }, {} as { [key: string]: ParamConfig });
  return params;
}

export function SchemaBody<T>(cls: Class<T>, view?: string) {
  return function (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<Filter>) {
    ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, {
      requestType: {
        type: cls
      },
      filters: [
        async function (req: Request) {
          req.body = await getSchemaBody(req, cls, view);
        }
      ]
    });
  } as EndpointDecorator;
}

export function SchemaQuery<T>(cls: Class<T>, view?: string) {

  return function (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<Filter>) {
    const params = schemaToParams(cls, view);

    ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, {
      params: { ...params },
      filters: [
        async (req: Request) => {
          const o = getBound(cls, BindUtil.expandPaths(req.query), view);
          if (SchemaRegistry.has(cls)) {
            req.query = await SchemaValidator.validate(o, view);
          } else {
            req.query = o;
          }
        }
      ]
    });
  } as EndpointDecorator;
}