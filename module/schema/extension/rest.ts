import { ControllerRegistry, ParamConfig, Filter, EndpointDecorator, Request } from '@travetto/rest';
import { Util, AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

import { SchemaRegistry, BindUtil, SchemaValidator } from '..';

function getBound<T>(cls: Class<T>, obj: any, view?: string) {
  try {
    const resolved = SchemaRegistry.get(cls).class; // Get actual class separate from decorator value
    return BindUtil.bindSchema(resolved, obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatible with ${cls.__id}: ${e.message}`);
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
    throw new AppError(`Body is missing or wrong type: ${req.body}`, 'data');
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
    // Need to wait on schema finalization
    SchemaRegistry.on(function work(ev) {
      if (ev.type === 'added' && ev.curr!.name === cls.name) {
        SchemaRegistry['events'].off('change', work); // Unregister
        const params = schemaToParams(cls, view);
        ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { params });
      }
    });

    ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, {
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