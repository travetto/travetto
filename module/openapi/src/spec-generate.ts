import { Readable } from 'stream';
import type {
  SchemaObject, SchemasObject, ParameterObject, OperationObject,
  RequestBodyObject, TagObject, PathsObject
} from 'openapi3-ts/src/model/OpenApi';

import { ControllerRegistry, EndpointConfig, ControllerConfig, ParamConfig, EndpointIOType } from '@travetto/rest';
import { Class } from '@travetto/base';
import { SchemaRegistry, FieldConfig } from '@travetto/schema';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

import { ApiSpecConfig } from './config';
import { OpenApiController } from './controller';

const DEFINITION = '#/components/schemas';

function isFieldConfig(val: object): val is FieldConfig {
  return !!val && 'owner' in val && 'type' in val;
}

type GeneratedSpec = {
  tags: TagObject[];
  paths: PathsObject;
  components: {
    schemas: SchemasObject;
  };
};

/**
 * Spec generation utilities
 */
export class SpecGenerator {
  #tags: TagObject[] = [];
  #allSchemas: SchemasObject = {};
  #schemas: SchemasObject = {};
  #paths: PathsObject = {};

  /**
   * Get type id
   * @param cls
   */
  #getTypeId(cls: Class): string {
    return cls.name?.replace('Ⲑsyn', '');
  }

  /**
   * Get tag name
   * @param cls
   */
  #getTypeTag(cls: Class): string {
    return cls.name.replace(/(Rest|Controller)$/, '');
  }

  /**
   * Build response object
   */
  #getHeaderValue(ep: EndpointConfig, header: string): string | undefined {
    let cType = ep.headers?.[header];
    if (cType && typeof cType !== 'string') {
      cType = cType();
    }
    return cType;
  }

  /**
   * Convert schema to a set of dotted parameters
   */
  #schemaToDotParams(location: 'query' | 'header', field: FieldConfig, prefix: string = '', rootField: FieldConfig = field): ParameterObject[] {
    const viewConf = SchemaRegistry.has(field.type) && SchemaRegistry.getViewSchema(field.type, field.view);
    const schemaConf = viewConf && viewConf.schema;
    if (!schemaConf) {
      throw new Error(`Unknown class, not registered as a schema: ${field.type.ᚕid}`);
    }
    const params: ParameterObject[] = [];
    for (const sub of Object.values(schemaConf)) {
      if (SchemaRegistry.has(sub.type) || SchemaRegistry.hasPending(sub.type)) {
        const suffix = (sub.array) ? '[]' : '';
        params.push(...this.#schemaToDotParams(location, sub, prefix ? `${prefix}.${sub.name}${suffix}` : `${sub.name}${suffix}.`, rootField));
      } else {
        params.push({
          name: `${prefix}${sub.name}`,
          description: sub.description,
          schema: sub.array ? {
            type: 'array',
            ...this.#getType(sub)
          } : this.#getType(sub),
          required: !!(rootField?.required?.active && sub.required?.active),
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
  #getType(fieldOrClass: FieldConfig | Class): Record<string, unknown> {
    let field: { type: Class<unknown>, precision?: [number, number | undefined] };
    if (!isFieldConfig(fieldOrClass)) {
      field = { type: fieldOrClass };
    } else {
      field = fieldOrClass;
    }
    const out: Record<string, unknown> = {};
    // Handle nested types
    if (SchemaRegistry.has(field.type)) {
      const id = this.#getTypeId(field.type);
      // Exposing
      this.#schemas[id] = this.#allSchemas[id];
      out.$ref = `${DEFINITION}/${id}`;
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
   * Get upload body
   */
  #buildUploadBody(): RequestBodyObject {
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
   * Process schema field
   */
  #processSchemaField(field: FieldConfig, required: string[]): SchemaObject {
    let prop: SchemaObject = this.#getType(field);

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
      prop.minimum = typeof field.min.n === 'number' ? field.min.n : field.min.n.getTime();
    }
    if (field.max) {
      prop.maximum = typeof field.max.n === 'number' ? field.max.n : field.max.n.getTime();
    }
    if (field.enum) {
      prop.enum = field.enum.values;
    }
    if (field.required && field.required.active) {
      required.push(field.name);
    }
    if (field.access === 'readonly') {
      prop.readOnly = true;
    } else if (field.access === 'writeonly') {
      prop.writeOnly = true;
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
  #processSchema(type?: string | Class): string | undefined {
    if (type === undefined || typeof type === 'string') {
      return undefined;
    }

    const typeId = this.#getTypeId(type);

    if (!this.#allSchemas[typeId]) {
      const config = SchemaRegistry.get(type);
      if (config) {
        this.#allSchemas[typeId] = {
          title: config.title || config.description,
          description: config.description || config.title,
          example: config.examples
        };

        const properties: Record<string, SchemaObject> = {};
        const def = config.views[AllViewⲐ];
        const required: string[] = [];

        for (const fieldName of def.fields) {
          if (SchemaRegistry.has(def.schema[fieldName].type)) {
            this.#processSchema(def.schema[fieldName].type);
          }
          properties[fieldName] = this.#processSchemaField(def.schema[fieldName], required);
        }

        Object.assign(this.#allSchemas[typeId], {
          properties,
          ...(required.length ? { required } : {})
        });
      } else {
        this.#allSchemas[typeId] = { title: typeId };
      }
    }
    return typeId;
  }

  /**
   * Standard payload structure
   */
  #getEndpointBody(body?: EndpointIOType, mime?: string): RequestBodyObject {
    if (!body) {
      return { content: {}, description: '' };
    } else if (body.type === Readable || body.type === Buffer) {
      return {
        content: {
          [mime ?? 'application/octet-stream']: { type: 'string', format: 'binary' }
        },
        description: ''
      };
    } else {
      const typeId = this.#getTypeId(body.type);
      const typeRef = SchemaRegistry.has(body.type) ? this.#getType(body.type) : { type: body.type.name.toLowerCase() };
      return {
        content: {
          [mime ?? 'application/json']: {
            schema: !body!.array ? typeRef : { type: 'array', items: typeRef }
          }
        },
        description: this.#allSchemas[typeId!]?.description ?? ''
      };
    }
  }

  /**
   * Process endpoint parameter
   */
  #processEndpointParam(ep: EndpointConfig, param: ParamConfig, field: FieldConfig): (
    { requestBody: RequestBodyObject } |
    { parameters: ParameterObject[] } |
    undefined
  ) {
    if (param.location) {
      if (param.location === 'body') {
        return {
          requestBody: field.specifier === 'file' ? this.#buildUploadBody() : this.#getEndpointBody(field, this.#getHeaderValue(ep, 'accepts'))
        };
      } else if (field.type && SchemaRegistry.has(field.type) && (param.location === 'query' || param.location === 'header')) {
        return { parameters: this.#schemaToDotParams(param.location, field) };
      } else if (param.location !== 'context') {
        const epParam: ParameterObject = {
          in: param.location,
          name: param.name || param.location,
          description: field.description,
          required: !!field.required?.active || false,
          schema: field.array ? { type: 'array', items: this.#getType(field) } : this.#getType(field)
        };
        return { parameters: [epParam] };
      } else if (field.specifier === 'file') {
        return { requestBody: this.#buildUploadBody() };
      }
    }
  }

  /**
   * Process controller endpoint
   */
  processEndpoint(ctrl: ControllerConfig, ep: EndpointConfig): void {

    const tagName = ctrl.class.name.replace(/(Rest|Controller)$/, '');

    const op: OperationObject = {
      tags: [tagName],
      responses: {},
      summary: ep.title,
      description: ep.description || ep.title,
      operationId: `${ep.class.name}_${ep.handlerName}`,
      parameters: []
    };

    const pConf = this.#getEndpointBody(ep.responseType, this.#getHeaderValue(ep, 'content-type'));
    const code = Object.keys(pConf.content).length ? 200 : 201;
    op.responses[code] = pConf;

    const schema = SchemaRegistry.getMethodSchema(ep.class, ep.handlerName);
    for (const field of schema) {
      const res = this.#processEndpointParam(ep, ep.params[field.index!], field);
      if (res) {
        if ('parameters' in res) {
          (op.parameters ??= []).push(...res.parameters);
        } else {
          op.requestBody ??= res.requestBody;
        }
      }
    }

    const epPath = (
      !ep.path ? '/' : typeof ep.path === 'string' ? ep.path : ep.path.source
    ).replace(/:([A-Za-z0-9_]+)\b/g, (__, param) => `{${param}}`);

    const key = `${ctrl.basePath}${epPath}`.replace(/[\/]+/g, '/');

    const toAdd = ep.method === 'all' ?
      ['get', 'post', 'put', 'delete', 'patch'].reduce((acc, v) =>
        ({ ...acc, [v]: { ...op, operationId: `${op.operationId}_${v}` } }), {}) :
      { [ep.method]: op };

    this.#paths[key] = {
      ...(this.#paths[key] ?? {}),
      ...toAdd
    };
  }

  /**
   * Process each controller
   */
  processController(cls: Class): void {
    const ctrl = ControllerRegistry.get(cls);

    this.#tags.push({
      name: this.#getTypeTag(ctrl.class),
      description: ctrl.description || ctrl.title
    });

    for (const ep of ctrl.endpoints) {
      this.processEndpoint(ctrl, ep);
    }
  }

  /**
   * Generate full specification
   */
  generate(config: Partial<ApiSpecConfig> = {}): GeneratedSpec {

    for (const cls of ControllerRegistry.getClasses()) {
      for (const ep of ControllerRegistry.get(cls).endpoints) {
        if (ep.requestType) {
          this.#processSchema(ep.requestType.type);
        }
        if (ep.responseType) {
          this.#processSchema(ep.responseType.type);
        }
        for (const param of SchemaRegistry.getMethodSchema(cls, ep.handlerName)) {
          this.#processSchema(param.type);
        }
      }
    }

    if (!config.skipRoutes) {
      for (const cls of ControllerRegistry.getClasses()) {
        if (cls.ᚕid !== OpenApiController.ᚕid) {
          this.processController(cls);
        }
      }
    }

    if (config.exposeAllSchemas) {
      this.#schemas = this.#allSchemas;
    }

    return {
      tags: this.#tags,
      paths: this.#paths,
      components: {
        schemas: this.#schemas
      }
    };
  }
}