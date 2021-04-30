import { SchemaObject, OpenAPIObject, SchemasObject, ParameterObject, OperationObject, RequestBodyObject } from 'openapi3-ts/src/model/OpenApi';

import { ControllerRegistry, EndpointClassType, EndpointIOType, EndpointConfig, ControllerConfig, ParamConfig } from '@travetto/rest';
import { Class, Util } from '@travetto/base';
import { SchemaRegistry, FieldConfig } from '@travetto/schema';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

import { ApiSpecConfig } from './config';
import { Readable } from 'stream';

export function isEndpointClassType(o: EndpointIOType): o is EndpointClassType {
  return !!o && !('mime' in o);
}

const DEFINITION = '#/components/schemas';

type PartialSpec = Required<Pick<OpenAPIObject, 'tags' | 'components' | 'paths'>> & { components: { schemas: SchemasObject } };

/**
 * Spec generation utilities
 */
export class SpecGenerateUtil {

  /**
   * Convert schema to a set of dotted parameters
   */
  static #schemaToDotParams(state: PartialSpec, location: 'query' | 'header', cls: Class, view?: string, prefix: string = ''): ParameterObject[] {
    const viewConf = SchemaRegistry.has(cls) && SchemaRegistry.getViewSchema(cls, view);
    const schemaConf = viewConf && viewConf.schema;
    if (!schemaConf) {
      throw new Error(`Unknown class, not registered as a schema: ${cls.ᚕid}`);
    }
    const params: ParameterObject[] = [];
    for (const field of Object.values(schemaConf)) {
      if (SchemaRegistry.has(field.type) || SchemaRegistry.hasPending(field.type)) {
        const suffix = (field.array) ? '[]' : '';
        params.push(...this.#schemaToDotParams(state, location, field.type, undefined, prefix ? `${prefix}.${field.name}${suffix}` : `${field.name}${suffix}.`));
      } else {
        params.push({
          name: `${prefix}${field.name}`,
          description: field.description,
          schema: field.array ? {
            type: 'array',
            ...this.#getType(field, state)
          } : this.#getType(field, state),
          required: field.required && !!field.required.active,
          in: location,
          extract: undefined
        });
      }
    }
    return params;
  }

  /**
   * Get the type for a given class
   */
  static #getType(field: FieldConfig | Class, state: PartialSpec) {
    if (!Util.isPlainObject(field)) {
      field = { type: field } as FieldConfig;
    }
    field = field as FieldConfig;
    const out: Record<string, unknown> = {};
    // Handle nested types
    if (SchemaRegistry.has(field.type)) {
      out.$ref = `${DEFINITION}/${this.#processSchema(field.type, state)}`;
    } else {
      switch (field.type) {
        case String: out.type = 'string'; break;
        case Number: {
          if (field.precision) {
            const [, decimals] = field.precision;
            out.type = !decimals ? 'integer' : 'number';
          } else {
            out.type = 'number';
          }
          break;
        }
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

  /**
   * Process schema field
   */
  static #processSchemaField(field: FieldConfig, required: string[], state: PartialSpec) {
    let prop: SchemaObject = this.#getType(field, state);

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
      required.push(field.name);
    }

    if (field.array) {
      prop = {
        type: 'array',
        items: prop
      };
    }

    return prop;
  }

  /**
   * Process schema class
   */
  static #processSchema(type: string | Class | undefined, state: PartialSpec) {
    if (type === undefined || typeof type === 'string') {
      return undefined;
    }

    const typeId = type.name.replace(`ᚕsyn`, '');

    if (!state.components.schemas[typeId]) {
      const config = SchemaRegistry.get(type);
      if (config) {
        state.components.schemas[typeId] = {
          title: config.title || config.description,
          description: config.description || config.title,
          example: config.examples
        };

        const properties: Record<string, SchemaObject> = {};
        const def = config.views[AllViewⲐ];
        const required: string[] = [];

        for (const fieldName of def.fields) {
          properties[fieldName] = this.#processSchemaField(def.schema[fieldName], required, state);
        }

        Object.assign(state.components.schemas[typeId], {
          properties,
          ...(required.length ? { required } : {})
        });
      } else {
        state.components.schemas[typeId] = { title: typeId };
      }
    }
    return typeId;
  }

  /**
   * Standard JSON body structure
   */
  static #getJsonBody(state: PartialSpec, body: EndpointClassType): RequestBodyObject {
    const schemaName = this.#processSchema(body.type, state);
    if (schemaName && schemaName !== 'void' && schemaName !== 'undefined') {
      const ref: SchemaObject = this.#getType(body.type, state);
      return {
        content: { 'application/json': { schema: !body!.array ? ref : { type: 'array', items: ref } } },
        description: state.components.schemas[schemaName!].description ?? '',
      };
    }
    return { description: '', content: {} };
  }

  /**
   * Build response object
   */
  static #buildResponseObject(state: PartialSpec, ep: EndpointConfig): RequestBodyObject {
    const resType = ep.responseType;
    if (!resType) {
      return { description: '', content: {} };
    }
    let cType = ep.headers?.['content-type'];
    if (cType && typeof cType !== 'string') {
      cType = cType();
    }
    const mime = cType ?? ('mime' in resType ? resType.mime : '');
    if (resType.type === Readable || resType.type === Buffer) {
      return {
        description: '',
        content: mime ? { [mime]: {} } : { 'application/octect-stream': { type: 'string', format: 'binary' } }
      };
    } else if (isEndpointClassType(resType)) {
      return this.#getJsonBody(state, resType);
    } else {
      return {
        description: '',
        content: { [mime]: { schema: { type: resType.type as 'string' } } }
      };
    }
  }

  /**
   * Get upload body
   */
  static #buildUploadBody(): RequestBodyObject {
    return {
      description: 'Uploaded files',
      content: {
        'multipart/form-data': {
          schema: { properties: { file: { type: 'array', items: { type: 'string', format: 'binary' } } } }
        }
      }
    };
  }

  /**
   * Process endpoint parameter
   */
  static #processEndpointParam(op: OperationObject, param: ParamConfig, field: FieldConfig, state: PartialSpec) {
    if (param.location) {
      if (param.location === 'body') {
        op.requestBody = field.specifier === 'file' ? this.#buildUploadBody() : this.#getJsonBody(state, field);
      } else if (field.type && SchemaRegistry.has(field.type) && (param.location === 'query' || param.location === 'header')) {
        op.parameters!.push(...this.#schemaToDotParams(state, param.location, field.type));
      } else if (param.location !== 'context') {
        const epParam: ParameterObject = {
          in: param.location as 'path',
          name: param.name || param.location,
          description: field.description,
          required: !!field.required?.active || false,
          schema: this.#getType(field, state)
        };
        op.parameters!.push(epParam);
      } else if (field.specifier === 'file') {
        op.requestBody = this.#buildUploadBody();
      }
    }
  }

  /**
   * Process controller endpoint
   */
  static processEndpoint(tagName: string, ctrl: ControllerConfig, ep: EndpointConfig, state: PartialSpec) {
    const op: OperationObject = {
      tags: [tagName],
      responses: {},
      summary: ep.title,
      description: ep.description || ep.title,
      operationId: `${ep.class.name}_${ep.handlerName}`,
      parameters: []
    };

    const pConf = this.#buildResponseObject(state, ep);
    const code = Object.keys(pConf.content).length ? 200 : 201;
    op.responses[code] = pConf;

    const schema = SchemaRegistry.getMethodSchema(ep.class, ep.handlerName);
    ep.params.forEach((param, i) => schema[i] ? this.#processEndpointParam(op, param, schema[i], state) : undefined);

    const epPath = (
      !ep.path ? '/' : typeof ep.path === 'string' ? (ep.path as string) : (ep.path as RegExp).source
    ).replace(/:([A-Za-z0-9_]+)\b/g, (__, param) => `{${param}}`);

    const key = `${ctrl.basePath}${epPath}`.replace(/[\/]+/g, '/');

    const toAdd = ep.method === 'all' ?
      ['get', 'post', 'put', 'delete', 'patch'].reduce((acc, v) =>
        ({ ...acc, [v]: { ...op, operationId: `${op.operationId}_${v}` } }), {}) :
      { [ep.method]: op };

    state.paths[key] = {
      ...(state.paths[key] ?? {}),
      ...toAdd
    };
  }

  /**
   * Process each controller
   */
  static processController(cls: Class, state: PartialSpec) {
    const ctrl = ControllerRegistry.get(cls);
    const tagName = ctrl.class.name.replace(/(Rest|Controller)$/, '');

    if (tagName === 'OpenApi') {
      return;
    }

    state.tags.push({
      name: tagName,
      description: ctrl.description || ctrl.title
    });

    for (const ep of ctrl.endpoints) {
      this.processEndpoint(tagName, ctrl, ep, state);
    }
  }

  /**
   * Generate full specification
   */
  static generate(config: ApiSpecConfig): OpenAPIObject {
    const state: PartialSpec = {
      paths: {},
      components: { schemas: {} },
      tags: []
    };

    // Prime all schemas
    if (config.exposeAllSchemas) {
      for (const cls of SchemaRegistry.getClasses()) {
        this.#processSchema(cls, state);
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