import { Readable } from 'node:stream';
import type {
  SchemaObject, SchemasObject, ParameterObject, OperationObject,
  RequestBodyObject, TagObject, PathsObject, PathItemObject
} from 'openapi3-ts/oas31';

import {
  EndpointConfig, ControllerConfig, EndpointParamConfig, EndpointIOType, ControllerVisitor,
  ControllerRegistry, ReturnValueConfig, ReturnValueInterceptor, HttpHeaders
} from '@travetto/web';
import { Class, describeFunction } from '@travetto/runtime';
import { SchemaRegistry, FieldConfig, ClassConfig, SchemaNameResolver } from '@travetto/schema';

import { ApiSpecConfig } from './config.ts';

const DEFINITION = '#/components/schemas';

function isFieldConfig(val: object): val is FieldConfig {
  return !!val && 'owner' in val && 'type' in val;
}

type GeneratedSpec = {
  tags: TagObject[];
  paths: Record<string, PathItemObject>;
  components: {
    schemas: SchemasObject;
  };
};

/**
 * Spec generation utilities
 */
export class OpenapiVisitor implements ControllerVisitor<GeneratedSpec> {
  #tags: TagObject[] = [];
  #allSchemas: SchemasObject = {};
  #schemas: SchemasObject = {};
  #paths: PathsObject = {};

  #config: Partial<ApiSpecConfig> = {};

  #nameResolver = new SchemaNameResolver();

  constructor(config: Partial<ApiSpecConfig> = {}) {
    this.#config = config;
  }

  /**
   * Build response object
   */
  #getHeaderValue(ep: EndpointConfig, header: string): string | undefined | null {
    const classConfig = ControllerRegistry.get(ep.class);

    const configs = [...classConfig.interceptorConfigs ?? [], ...ep.interceptorConfigs ?? []].filter(
      (x): x is [Class, ReturnValueConfig] => x[0] instanceof ReturnValueInterceptor
    ).map(x => x[1].headers ?? {});

    return new HttpHeaders().setFunctionalHeaders(...configs).get(header);
  }

  /**
   * Convert schema to a set of dotted parameters
   */
  #schemaToDotParams(location: 'query' | 'header', field: FieldConfig, prefix: string = '', rootField: FieldConfig = field): ParameterObject[] {
    const viewConf = SchemaRegistry.has(field.type) && SchemaRegistry.getViewSchema(field.type, field.view);
    const schemaConf = viewConf && viewConf.schema;
    if (!schemaConf) {
      throw new Error(`Unknown class, not registered as a schema: ${field.type.Ⲑid}`);
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
          in: location
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
      const id = this.#nameResolver.getName(SchemaRegistry.get(field.type));
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
  onSchema(type?: ClassConfig): void {
    if (type === undefined) {
      return;
    }

    const cls = type.class;
    const typeId = this.#nameResolver.getName(type);

    if (!this.#allSchemas[typeId]) {
      const config = SchemaRegistry.get(cls);
      if (config) {
        this.#allSchemas[typeId] = {
          title: config.title || config.description,
          description: config.description || config.title,
          example: config.examples
        };

        const properties: Record<string, SchemaObject> = {};
        const def = config.totalView;
        const required: string[] = [];

        for (const fieldName of def.fields) {
          if (SchemaRegistry.has(def.schema[fieldName].type)) {
            this.onSchema(SchemaRegistry.get(def.schema[fieldName].type));
          }
          properties[fieldName] = this.#processSchemaField(def.schema[fieldName], required);
        }

        const extra: Record<string, unknown> = {};
        if (describeFunction(cls)?.abstract) {
          const map = SchemaRegistry.getSubTypesForClass(cls);
          if (map) {
            extra.oneOf = map
              .filter(x => !describeFunction(x)?.abstract)
              .map(c => {
                this.onSchema(SchemaRegistry.get(c));
                return this.#getType(c);
              });
          }
        }

        Object.assign(this.#allSchemas[typeId], {
          properties,
          ...(required.length ? { required } : {}),
          ...extra
        });
      } else {
        this.#allSchemas[typeId] = { title: typeId };
      }
    }
  }

  /**
   * Standard payload structure
   */
  #getEndpointBody(body?: EndpointIOType, mime?: string | null): RequestBodyObject {
    if (!body) {
      return { content: {}, description: '' };
    } else if (body.type === Readable || body.type === Buffer) {
      return {
        content: {
          [mime ?? 'application/octet-stream']: { schema: { type: 'string', format: 'binary' } }
        },
        description: ''
      };
    } else {
      const cls = SchemaRegistry.get(body.type);
      const typeId = cls ? this.#nameResolver.getName(cls) : body.type.name;
      const typeRef = cls ? this.#getType(body.type) : { type: body.type.name.toLowerCase() };
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
  #processEndpointParam(ep: EndpointConfig, param: EndpointParamConfig, field: FieldConfig): (
    { requestBody: RequestBodyObject } |
    { parameters: ParameterObject[] } |
    undefined
  ) {
    const complex = field.type && SchemaRegistry.has(field.type);
    if (param.location) {
      if (param.location === 'body') {
        return {
          requestBody: field.specifiers?.includes('file') ? this.#buildUploadBody() : this.#getEndpointBody(field, this.#getHeaderValue(ep, 'accepts'))
        };
      } else if (complex && (param.location === 'query' || param.location === 'header')) {
        return { parameters: this.#schemaToDotParams(param.location, field, param.prefix ? `${param.prefix}.` : '') };
      } else {
        const epParam: ParameterObject = {
          in: param.location,
          name: param.name || param.location,
          description: field.description,
          required: !!field.required?.active || false,
          schema: field.array ? { type: 'array', items: this.#getType(field) } : this.#getType(field)
        };
        return { parameters: [epParam] };
      }
    }
  }

  /**
   * Process controller endpoint
   */
  onEndpointEnd(ep: EndpointConfig, ctrl: ControllerConfig): void {
    if (this.#config.skipEndpoints) {
      return;
    }

    const tagName = ctrl.externalName;

    const op: OperationObject = {
      tags: [tagName],
      responses: {},
      summary: ep.title,
      description: ep.description || ep.title,
      operationId: `${ep.class.name}_${ep.name}`,
      parameters: []
    };

    const pConf = this.#getEndpointBody(ep.responseType, this.#getHeaderValue(ep, 'content-type'));
    const code = Object.keys(pConf.content).length ? 200 : 201;
    op.responses![code] = pConf;

    const schema = SchemaRegistry.getMethodSchema(ep.class, ep.name);
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

    const epPath = (!ep.path ? '/' : ep.path).replace(/:([A-Za-z0-9_]+)\b/g, (__, param) => `{${param}}`);

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

  onControllerEnd(controller: ControllerConfig): void {
    if (this.#config.skipEndpoints) {
      return;
    }
    this.#tags.push({
      name: controller.externalName,
      description: controller.description || controller.title
    });
  }

  onComplete(): GeneratedSpec {
    if (this.#config.exposeAllSchemas) {
      this.#schemas = this.#allSchemas;
    }

    return {
      tags: this.#tags.sort((a, b) => a.name.localeCompare(b.name)),
      paths: Object.fromEntries(
        Object.entries(this.#paths)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
          )])
      ),
      components: {
        schemas: Object.fromEntries(
          Object.entries(this.#schemas)
            .sort(([a], [b]) => a.localeCompare(b))
        )
      }
    };
  }
}