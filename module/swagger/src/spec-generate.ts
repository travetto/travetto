import { ControllerRegistry, MimeType, EndpointClassType, ParamConfig } from '@travetto/rest';

import { Class } from '@travetto/registry';
import { SchemaRegistry, ALL_VIEW } from '@travetto/schema';

import { ApiClientConfig } from './config';

import { Schema, Path, Parameter, Response, Operation, Spec } from 'swagger-schema-official';

export function isEndpointClassType(o: any): o is EndpointClassType {
  return !!o && !o.mime;
}

const DEFINITION = '#/definitions';

interface Tag {
  name: string;
  description?: string;
}

interface PartialSpec {
  tags: Tag[];
  definitions: { [key: string]: Schema };
  paths: { [key: string]: Path };
}

export class SpecGenerateUtil {

  static schemaToQueryParams(cls: Class, view?: string, prefix: string = '') {
    const viewConf = SchemaRegistry.has(cls) && SchemaRegistry.getViewSchema(cls, view);
    const schemaConf = viewConf && viewConf.schema;
    if (!schemaConf) {
      throw new Error(`Unknown class, not registered as a schema: ${cls.__id}`);
    }
    const params = Object.keys(schemaConf).reduce((acc, x) => {
      const field = schemaConf[x];
      if (SchemaRegistry.has(field.type) || SchemaRegistry.hasPending(field.type)) {
        acc = [...acc, ...this.schemaToQueryParams(field.type, undefined, prefix ? `${prefix}.${field.name}` : `${field.name}.`)];
      } else {
        acc.push({
          name: `${prefix}${field.name}`,
          description: field.description,
          array: field.array,
          type: field.type,
          required: field.required && field.required.active,
          location: 'query',
          extract: undefined as any
        });
      }
      return acc;
    }, [] as ParamConfig[]);
    return params;
  }

  static getType(cls: Class, state: PartialSpec) {
    const out: { [key: string]: any } = {};
    // Handle nested types
    if (SchemaRegistry.has(cls)) {
      out.$ref = `${DEFINITION}/${this.processSchema(cls, state)}`;
      out.type = 'object';
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

      if (!state.definitions[typeId]) {
        const config = SchemaRegistry.get(type);
        if (config) {
          const properties: { [key: string]: Schema } = {};
          const def = config.views[ALL_VIEW];
          const required = [];

          for (const fieldName of def.fields) {
            const field = def.schema[fieldName];
            let prop: Schema = this.getType(field.type, state);

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
            if (field.required) {
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

          state.definitions[typeId] = {
            title: config.title || config.description,
            description: config.description || config.title,
            example: config.examples,
            properties,
            required
          };
        } else {
          state.definitions[typeId] = { title: typeId };
        }
      }
      return typeId;
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

      const epParams: Parameter[] = [];
      const epProd = ep.responseType;
      const epCons = ep.requestType;
      const produces = [];
      const consumes = [];
      const responses: { [key: string]: Response } = {};

      if (epProd) {
        if (isEndpointClassType(epProd)) {
          const epProduces = this.processSchema(epProd.type, state);
          if (epProduces) {
            const ref: Schema = { $ref: `${DEFINITION}/${epProduces}` };
            responses[200] = {
              description: state.definitions[epProduces!].description || '',
              schema: epProd!.wrapper !== Array ? ref : { type: 'array', items: ref }
            };
            produces.push(MimeType.JSON);
          } else {
            responses[201] = {
              description: ''
            };
          }
        } else {
          produces.push(epProd.mime);
          responses[200] = {
            description: '',
            schema: {
              type: epProd.type
            }
          };
        }
      } else {
        responses[201] = {
          description: ''
        };
      }
      if (epCons) {
        if (isEndpointClassType(epCons)) {
          const epConsumes = this.processSchema(epCons.type, state);
          if (epConsumes) {
            const ref: Schema = { $ref: `${DEFINITION}/${epConsumes}` };
            epParams.push({
              in: 'body',
              name: 'body',
              description: state.definitions[epConsumes!].description || '',
              schema: epCons!.wrapper !== Array ? ref : { type: 'array', items: ref }
            } as Parameter);
            consumes.push(MimeType.JSON);
          }
        } else {
          consumes.push(epCons.mime);
          epParams.push({
            in: epCons.type === 'file' ? 'formData' : 'body',
            name: epCons.type === 'file' ? 'form' : 'body',
            type: epCons.type || 'object'
          } as Parameter);
        }
      }

      for (const param of ep.params) {
        if (param.type && param.location === 'query') {
          epParams.push(
            ...this.schemaToQueryParams(param.type, (param as any).view as any).map(x => ({
              in: param.location as 'header',
              name: x.name!,
              description: x.description,
              required: !!x.required,
              ...(this.getType(x.type, state) as any)
            }))
          );
        } else if (param.location === 'body' || param.location === 'query' || param.location === 'header' || param.location === 'path') {
          const epParam: Parameter = {
            in: param.location as 'body',
            name: param.name || param.location,
            description: param.description,
            required: !!param.required
          };
          if (param.type) {
            const type = this.getType(param.type!, state);
            if (type.$ref) {
              // Not supported yet
              // epParam.schema = type;
            } else {
              Object.assign(epParam, type);
            }
          }

          epParams.push(epParam);
        }
      }

      const epPath = !ep.path ? '/' : typeof ep.path === 'string' ? (ep.path as string) : (ep.path as RegExp).source;

      const key = `${ctrl.basePath}${epPath}`.replace(/[\/]+/g, '/');

      state.paths[key] = {
        ...(state.paths[key] || {}),
        [ep.method!]: {
          tags: [tagName],
          produces,
          consumes,
          responses,
          summary: ep.title,
          description: ep.description || ep.title,
          operationId: `${ep.class.name}_${ep.handlerName}`,
          parameters: epParams
        } as Operation
      };
    }
  }

  static generate(config: ApiClientConfig): Partial<Spec> {
    const state: PartialSpec = {
      paths: {},
      definitions: {},
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

    return state as Partial<Spec>;
  }
}