import { ControllerRegistry, MimeType, EndpointClassType, ParamConfig, EndpointIOType } from '@travetto/rest';

import { Class } from '@travetto/registry';
import { SchemaRegistry, ALL_VIEW } from '@travetto/schema';

import { ApiClientConfig } from './config';

import { SchemaObject, OpenAPIObject, SchemasObject, ParameterObject, OperationObject } from 'openapi3-ts';

export function isEndpointClassType(o: EndpointIOType): o is EndpointClassType {
  return !!o && !('mime' in o);
}

const DEFINITION = '#/components/schemas';

interface Tag {
  name: string;
  description?: string;
}

type PartialSpec = Required<Pick<OpenAPIObject, 'tags' | 'components' | 'paths'>> & { components: { schemas: SchemasObject } };

export class SpecGenerateUtil {

  static schemaToDotParams(state: PartialSpec, location: 'query' | 'header', cls: Class, view?: string, prefix: string = ''): ParameterObject[] {
    const viewConf = SchemaRegistry.has(cls) && SchemaRegistry.getViewSchema(cls, view);
    const schemaConf = viewConf && viewConf.schema;
    if (!schemaConf) {
      throw new Error(`Unknown class, not registered as a schema: ${cls.__id}`);
    }
    const params = Object.keys(schemaConf).reduce((acc, x) => {
      const field = schemaConf[x];
      if (SchemaRegistry.has(field.type) || SchemaRegistry.hasPending(field.type)) {
        acc = [...acc, ...this.schemaToDotParams(state, location, field.type, undefined, prefix ? `${prefix}.${field.name}` : `${field.name}.`)];
      } else {
        acc.push({
          name: `${prefix}${field.name}`,
          description: field.description,
          schema: field.array ? {
            type: 'array',
            ...this.getType(field.type, state)
          } : this.getType(field.type, state),
          required: field.required && !!field.required.active,
          in: location,
          extract: undefined as any
        });
      }
      return acc;
    }, [] as ParameterObject[]);
    return params;
  }

  static getType(cls: Class, state: PartialSpec) {
    const out: Record<string, any> = {};
    // Handle nested types
    if (SchemaRegistry.has(cls)) {
      out.$ref = `${DEFINITION}/${this.processSchema(cls, state)}`;
    } else {
      switch (cls) {
        case String: out.type = 'string'; break;
        case Number: out.type = 'number'; break;
        case Date:
          out.format = 'date-time';
          out.type = 'string';
          break;
        case Boolean: out.type = 'boolean'; break;
        default:
          out.type = 'object';
          break;
      }
    }
    return out;
  }

  static processSchema(type: string | Class | undefined, state: PartialSpec) {
    if (type === undefined || typeof type === 'string') {
      return undefined;
    } else {
      const typeId = type.name;

      if (!state.components.schemas[typeId]) {
        const config = SchemaRegistry.get(type);
        if (config) {
          const properties: Record<string, SchemaObject> = {};
          const def = config.views[ALL_VIEW];
          const required = [];

          for (const fieldName of def.fields) {
            const field = def.schema[fieldName];
            let prop: SchemaObject = this.getType(field.type, state);

            if (field.examples) {
              prop.example = field.examples;
            }
            prop.description = field.description;
            if (field.match) {
              prop.pattern = field.match.re!.source;
            }
            if (field.maxlength) {
              prop.maxLength = field.maxlength.n;
            }
            if (field.minlength) {
              prop.minLength = field.minlength.n;
            }
            if (field.min) {
              prop.minimum = field.min.n as number;
            }
            if (field.max) {
              prop.maximum = field.max.n as number;
            }
            if (field.enum) {
              prop.enum = field.enum.values;
            }
            if (field.required && field.required.active) {
              required.push(fieldName);
            }

            if (field.array) {
              prop = {
                type: 'array',
                items: prop
              };
            }

            properties[fieldName] = prop;
          }

          state.components.schemas[typeId] = {
            title: config.title || config.description,
            description: config.description || config.title,
            example: config.examples,
            properties,
            ...(required.length ? { required } : {})
          };
        } else {
          state.components.schemas[typeId] = { title: typeId };
        }
      }
      return typeId;
    }
  }

  static buildReqResObject(state: PartialSpec, eType?: EndpointIOType) {
    if (!eType) {
      return { description: '' };
    }
    if (isEndpointClassType(eType)) {
      const schemaName = this.processSchema(eType.type, state);
      if (schemaName) {
        const ref: SchemaObject = this.getType(eType.type, state);
        return {
          content: {
            [MimeType.JSON]: {
              schema: !eType!.array ? ref : { type: 'array', items: ref }
            }
          },
          description: state.components.schemas[schemaName!].description ?? '',
        };
      } else {
        return {
          description: ''
        };
      }
    } else {
      return {
        description: '',
        content: {
          [eType.mime]: {
            schema: {
              type: eType.type
            }
          }
        }
      };
    }
  }

  static buildRequestBody(state: PartialSpec, type: EndpointIOType) {
    const cConf = this.buildReqResObject(state, type);
    if (type && type.type === 'file') {
      return {
        content: {
          [MimeType.MULTIPART]: {
            schema: {
              properties: {
                file: {
                  type: 'array',
                  items: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        }
      };
    } else if (cConf.content) {
      return cConf;
    } else {
      return undefined;
    }
  }

  static processController(cls: Class, state: PartialSpec) {
    const ctrl = ControllerRegistry.get(cls);
    const tagName = ctrl.class.name.replace(/(Rest|Controller)$/, '');

    if (tagName === 'Swagger') {
      return;
    }

    state.tags.push({
      name: tagName,
      description: ctrl.description || ctrl.title
    });

    for (const ep of ctrl.endpoints) {

      const op: OperationObject = {
        tags: [tagName],
        responses: {},
        summary: ep.title,
        description: ep.description || ep.title,
        operationId: `${ep.class.name}_${ep.handlerName}`,
        parameters: []
      };

      const pConf = this.buildReqResObject(state, ep.responseType);
      const code = pConf.content ? 200 : 201;
      op.responses[code] = pConf;

      ep.params.forEach(param => {
        if (param.location) {
          if (param.location === 'body') {
            op.requestBody = this.buildRequestBody(state, param) as any;
          } else if (param.type && SchemaRegistry.has(param.type) && (param.location === 'query' || param.location === 'header')) {
            op.parameters!.push(...this.schemaToDotParams(state, param.location, param.type));
          } else if (param.location !== 'context') {
            const epParam: ParameterObject = {
              in: param.location as 'path',
              name: param.name || param.location,
              description: param.description,
              required: !!param.required || false,
              schema: this.getType(param.type, state)
            };
            op.parameters!.push(epParam);
          }
        }
      });

      const epPath = (
        !ep.path ? '/' : typeof ep.path === 'string' ? (ep.path as string) : (ep.path as RegExp).source
      ).replace(/:([A-Za-z0-9_]+)\b/g, (_, param) => `{${param}}`);

      const key = `${ctrl.basePath}${epPath}`.replace(/[\/]+/g, '/');

      const toAdd = ep.method === 'all' ?
        ['get', 'post', 'put', 'delete'].reduce((acc, v) =>
          ({ ...acc, [v]: { ...op, operationId: `${op.operationId}_${v}` } }), {}) :
        { [ep.method!]: op };

      state.paths[key] = {
        ...(state.paths[key] ?? {}),
        ...toAdd
      };
    }
  }

  static generate(config: ApiClientConfig): OpenAPIObject {
    const state: PartialSpec = {
      paths: {},
      components: { schemas: {} },
      tags: []
    };

    // Prime all schemas
    if (config.exposeAllSchemas) {
      for (const cls of SchemaRegistry.getClasses()) {
        this.processSchema(cls, state);
      }
    }

    if (!config.skipRoutes) {
      for (const cls of ControllerRegistry.getClasses()) {
        this.processController(cls, state);
      }
    }

    return state as OpenAPIObject;
  }
}